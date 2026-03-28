/***************
 * ROUTER
 ***************/
function doGet(e) {
  try {
    const action = (e.parameter.action || "").trim();
    _requireAuth_(e);

    if (action === "ping") {
      return _json_({ ok: true, data: { ts: new Date().toISOString() } });
    }


    return _json_({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    return _json_({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function doPost(e) {
  try {
    const action = (e.parameter.action || "").trim();
    _requireAuth_(e);

    const bodyText = (e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(bodyText);

    if (action === "createAttendanceSession") {
      _audit_("createAttendanceSession");
      return _json_({ ok: true, data: createAttendanceSession_(body) });
    }

    return _json_({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    return _json_({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

/***************
 * HELPERS
 ***************/
function _requireAuth_(e) {
  const expected = PropertiesService.getScriptProperties().getProperty("APP_TOKEN");
  if (!expected) return _json_({ ok: false, error: "APP_TOKEN not set" }, 500);

  const token = (e.parameter && e.parameter.token) ? String(e.parameter.token) : "";
  if (token !== expected) return _json_({ ok: false, error: "Unauthorized" }, 401);

  // ===== Hard Rate Limit (Max 100 req per 1 Jam / sliding window) =====
  // Jika menembus 100x beruntun, API akan diblokir selama 1 jam penuh 
  // sejak request terakhir. Ini melindungi Google Drive dari spam isi storage.
  const cache = CacheService.getScriptCache();
  const key = "rl_" + token;
  const hit = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(hit), 3600); // TTL 3600 detik (1 Jam)
  if (hit > 100) return _json_({ ok: false, error: "Rate limit exceeded. Please wait 1 hour." }, 429);
  // =======================================================
}

// Output JSON + HTTP Status Code
function _json_(data, status) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  // Jangan gunakan setStatusCode karena tidak didukung oleh Apps Script standard
  return out;
}

// Audit log sederhana
function _audit_(action) {
  try {
    console.log(`[${_nowIso_()}] ACTION=${action}`);
  } catch (_) {}
}

function _nowIso_() { return new Date().toISOString(); }
function _makeId_(prefix) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${rnd}`;
}

function _getProp_(key, required) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (required && !v) throw new Error(`${key} not set in Script Properties`);
  return v || "";
}


/***************


/***************
 * PRESENSI + PDF (REFACTORED: NO GOOGLE SHEETS)
 * Function ini sekarang 100% jadi Microservice pembuat PDF.
 * Hanya menerima data dari POST, menghasilkan PDF dari template, 
 * lalu me-return link URL hasilnya. (Single Source of Truth ada di Supabase)
 ***************/
function createAttendanceSession_(body) {
  const hdr = body.header || {};
  const participants = body.participants || [];
  const photos = body.photos || []; // base64 (max 4), from client compressed

  if (!hdr.activity_name) throw new Error("Nama Kegiatan wajib diisi");
  if (!hdr.date) throw new Error("Tanggal kegiatan wajib diisi");
  if (!participants.length) throw new Error("Minimal harus ada 1 peserta");

  const attendanceId = _makeId_("ATT");

  // 1. Upload photos ke Drive
  const photoFolderId = _getProp_("FOLDER_PHOTOS_ID", false);
  const photoFileIds = [];
  if (photoFolderId && photos.length) {
    const folder = DriveApp.getFolderById(photoFolderId);
    photos.slice(0,4).forEach((b64, i) => {
      try {
        const b64Str = String(b64);
        // Cegah eksploitasi storage: lewati jika base64 sangat besar (> 5 jt karakter ~ 3.7 MB)
        if (b64Str.length > 5000000) {
          console.warn(`Skip foto ${i+1}: Ukuran terlalu raksasa (Eksploitasi dicegah)`);
          return; // skip foto ini
        }
        
        const bytes = Utilities.base64Decode(b64Str.split(",").pop());
        const blob = Utilities.newBlob(bytes, "image/jpeg", `${attendanceId}_${i+1}.jpg`);
        const file = folder.createFile(blob);
        photoFileIds.push(file.getId());
      } catch (err) {
        console.warn(`Gagal upload foto ke-${i+1} untuk ${attendanceId}:`, String(err));
      }
    });
  }

  // 2. Siapkan Data Header untuk PDF
  const headerData = {
    attendance_id: attendanceId,
    activity_name: hdr.activity_name,
    date: hdr.date,
    day_name: hdr.day_name || "",
    time_start: hdr.time_start || "",
    time_end: hdr.time_end || "",
    location: hdr.location || "",
    note: hdr.note || "",
    photo_fileIds: photoFileIds.join(",")
  };

  // 3. Generate PDF Langsung (Tanpa mampir Google Sheet)
  let pdfId = "";
  let pdfError = "";
  try {
    pdfId = _generatePdf_(attendanceId, headerData, participants);
  } catch (e) {
    pdfError = String(e && e.message ? e.message : e);
  }

  return { 
    attendance_id: attendanceId, 
    pdf_fileId: pdfId, 
    pdf_url: pdfId ? `https://drive.google.com/file/d/${pdfId}/view` : "",
    pdf_error: pdfError, 
    photos: photoFileIds 
  };
}

function _normPresence_(v) {
  const s = String(v || "").trim();
  if (!s) return "Tanpa Keterangan";

  const up = s.toLowerCase();
  if (up === "hadir") return "Hadir";
  if (up === "izin" || up === "ijinh" || up === "ijin") return "Izin";
  if (up === "sakit") return "Sakit";
  if (up === "tanpa keterangan" || up === "tk" || up === "tanpa ket") return "Tanpa Keterangan";
  if (up === "alpa" || up === "alpha") return "Tanpa Keterangan";

  // fallback: kalau nilai aneh, anggap tanpa keterangan biar tidak merusak statistik
  return "Tanpa Keterangan";
}



/***************
 * PDF GENERATOR (V2 - TEMPLATE GOOGLE DOCS)
 ***************/
function _generatePdf_(attendanceId, header, participants) {
  const pdfFolderId = _getProp_("FOLDER_PDF_ID", true);
  const templateId = _getProp_("PDF_TEMPLATE_ID", true);

  const tanggalIndo = _formatTanggalIndo_(header.date);
  const waktuIndo = _formatWaktuIndo_(header.time_start, header.time_end);

  // 1) Copy template -> open as doc
  const copyFile = DriveApp.getFileById(templateId).makeCopy(`Presensi_${attendanceId}_DOC`);
  const doc = DocumentApp.openById(copyFile.getId());
  const body = doc.getBody();

  // 2) Hitung lebar efektif halaman (CONTENT_W)
  const layout = _getContentLayout_(doc);
  const CONTENT_W = layout.contentWidth;

  // 3) Temukan marker dan tentukan titik mulai insert konten
  const marker = "{{CONTENT_START}}";
  let insertIndex = _findAndRemoveMarkerInBody_(body, marker);
  if (insertIndex < 0) {
    // fallback: taruh di akhir dokumen jika marker tidak ditemukan
    insertIndex = body.getNumChildren();
  }

  // 4) Insert konten presensi (mulai dari insertIndex)
  insertIndex = _insertMetaBlock_(body, insertIndex, CONTENT_W, header, tanggalIndo, waktuIndo);
  insertIndex = _insertSpacer_(body, insertIndex, 6);

  insertIndex = _insertAttendanceTable_(body, insertIndex, CONTENT_W, participants);
  insertIndex = _insertSpacer_(body, insertIndex, 6);

  insertIndex = _insertNoteBlock_(body, insertIndex, CONTENT_W, header.note);
  insertIndex = _insertSpacer_(body, insertIndex, 8);

  insertIndex = _insertPhotosBlock_(body, insertIndex, CONTENT_W, header.photo_fileIds);

  doc.saveAndClose();

  // 5) Export PDF -> simpan di folder PDF
  const pdfBlob = DriveApp.getFileById(copyFile.getId()).getAs(MimeType.PDF);
  const pdfFile = DriveApp.getFolderById(pdfFolderId)
    .createFile(pdfBlob)
    .setName(`Presensi_${attendanceId}.pdf`);

  // 6) Bersihkan doc copy (opsional tapi recommended)
  DriveApp.getFileById(copyFile.getId()).setTrashed(true);

  return pdfFile.getId();
}

/***************
 * INSERT HELPERS (TEMPLATE MODE)
 ***************/
function _insertSpacer_(body, index, spacingAfter) {
  const p = body.insertParagraph(index, "");
  p.setSpacingBefore(0);
  p.setSpacingAfter(typeof spacingAfter === "number" ? spacingAfter : 0);
  p.setLineSpacing(1.0);
  return index + 1;
}

function _findAndRemoveMarkerInBody_(body, markerText) {
  try {
    const found = body.findText(markerText);
    if (!found) return -1;

    // Element yang berisi marker (biasanya Text di dalam Paragraph)
    const el = found.getElement();

    // Hapus teks marker (biar tidak tampil)
    try {
      el.asText().deleteText(found.getStartOffset(), found.getEndOffsetInclusive());
    } catch (e) {}

    // Cari "root child" di bawah Body (Table/Paragraph) untuk dapat index insert
    const rootChild = _getRootChildUnderBody_(el);
    if (!rootChild) return -1;

    const idx = body.getChildIndex(rootChild);
    // Insert setelah rootChild (misal setelah tabel/paragraph tempat marker berada)
    return idx + 1;
  } catch (e) {
    return -1;
  }
}

// Naikkan element ke atas sampai parent-nya Body, lalu kembalikan child yang langsung di bawah Body
function _getRootChildUnderBody_(element) {
  try {
    let cur = element;
    while (cur) {
      const parent = cur.getParent();
      if (!parent) return null;
      if (parent.getType && parent.getType() === DocumentApp.ElementType.BODY_SECTION) {
        return cur; // cur adalah child langsung di bawah Body
      }
      cur = parent;
    }
  } catch (e) {}
  return null;
}

function _insertMetaBlock_(body, index, contentW, header, tanggalIndo, waktuIndo) {
  // META 2 kolom, ":" di kolom kedua (sesuai request terakhir)
  const metaRows = [
    ["Kegiatan", header.activity_name || "-"],
    ["Tanggal", tanggalIndo || "-"],
    ["Waktu", waktuIndo || "-"],
    ["Tempat", header.location || "-"]
  ];

  const t = body.insertTable(index);
  _setTableWidth_(t, contentW);
  _makeTableBorderlessSoft_(t);

  // label dibuat lebih ramping
  const LABEL_W = 80; // kamu bisa tweak 70-100
  const VALUE_W = Math.max(50, contentW - LABEL_W);

  metaRows.forEach(([label, value]) => {
    const r = t.appendTableRow();

    const cL = r.appendTableCell(String(label));
    try { cL.setWidth(LABEL_W); } catch (e) {}
    cL.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
    const pL = cL.getChild(0).asParagraph();
    pL.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    pL.setBold(false);

    const cV = r.appendTableCell(`: ${value}`);
    try { cV.setWidth(VALUE_W); } catch (e) {}
    cV.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
    const pV = cV.getChild(0).asParagraph();
    pV.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    pV.setBold(false);
  });

  // 1 baris kosong setelah meta sebelum tabel presensi
  return index + 1;
}

function _insertAttendanceTable_(body, index, contentW, participants) {
  const table = body.insertTable(index);
  _setTableWidth_(table, contentW);

  // rasio kolom 1:5:3:3
  const totalRatio = 1 + 5 + 3 + 3; // 12
  const COL_NO = Math.floor(contentW * (1 / totalRatio));
  const COL_NAMA = Math.floor(contentW * (5 / totalRatio));
  const COL_JAB = Math.floor(contentW * (3 / totalRatio));
  const COL_HADIR = contentW - (COL_NO + COL_NAMA + COL_JAB);

  // Header
  const hr = table.appendTableRow();
  const hNo = hr.appendTableCell("No");
  const hNama = hr.appendTableCell("Nama");
  const hJab = hr.appendTableCell("Jabatan");
  const hHad = hr.appendTableCell("Kehadiran");

  _styleHeaderCell_(hNo, COL_NO);
  _styleHeaderCell_(hNama, COL_NAMA);
  _styleHeaderCell_(hJab, COL_JAB);
  _styleHeaderCell_(hHad, COL_HADIR);
  _forceRowWidths_(hr, [COL_NO, COL_NAMA, COL_JAB, COL_HADIR]);

  // Body
  (participants || []).forEach((p, i) => {
    const r = table.appendTableRow();

    const cNo = r.appendTableCell(String(i + 1));
    const cNama = r.appendTableCell(String(p.name || ""));
    const cJab = r.appendTableCell(String(p.role || ""));
    const cHad = r.appendTableCell(String(p.presence || ""));

    _styleBodyCellCenter_(cNo, COL_NO);
    _styleBodyCellLeft_(cNama, COL_NAMA);
    _styleBodyCellCenter_(cJab, COL_JAB);
    _styleBodyCellCenter_(cHad, COL_HADIR);

    _setCellParagraphBold_(cNo, false);
    _setCellParagraphBold_(cNama, false);
    _setCellParagraphBold_(cJab, false);
    _setCellParagraphBold_(cHad, false);

    _forceRowWidths_(r, [COL_NO, COL_NAMA, COL_JAB, COL_HADIR]);
  });

  return index + 1;
}

function _insertNoteBlock_(body, index, contentW, note) {
  // Normalisasi isi catatan
  const noteText = String(note || "").trim();

  // Kalau kosong → jangan generate apa pun
  if (!noteText) {
    return index;
  }

  // Judul
  const pTitle = body.insertParagraph(index, "Catatan");
  pTitle.setBold(true);
  pTitle.setSpacingBefore(0);
  pTitle.setSpacingAfter(4);
  pTitle.setLineSpacing(1.0);
  index++;

  // Kotak isi catatan
  const noteTable = body.insertTable(index, [[noteText]]);
  _setTableWidth_(noteTable, contentW);

  const cell = noteTable.getCell(0, 0);
  cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);

  const para = cell.getChild(0).asParagraph();
  para.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  para.setBold(false);

  return index + 1;
}


function _insertPhotosBlock_(body, index, contentW, photo_fileIds) {
  const ids = String(photo_fileIds || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  if (!ids.length) return index;

  // Judul tetap
  const pTitle = body.insertParagraph(index, "Lampiran Foto");
  pTitle.setBold(true);
  pTitle.setSpacingBefore(0);
  pTitle.setSpacingAfter(4);
  pTitle.setLineSpacing(1.0);
  index++;

  // Ukuran: kecil tapi pasti muat 2 kolom
  const GUTTER = 12;
  const cellW = Math.max(140, Math.floor((contentW - GUTTER) / 2));
  const portraitImgW = Math.max(110, Math.floor(cellW * 0.88));  // <= kecil & aman muat 2 kolom
  const landscapeImgW = Math.max(220, Math.floor(contentW * 0.92)); // biar stabil (tidak perlu full)

  let pendingPortraitId = null;

  for (let i = 0; i < ids.length; i++) {
    const fid = ids[i];

    // Deteksi orientasi via ImagesService (lebih konsisten daripada getWidth() inline image)
    let isLandscape = true;
    try {
      const blob0 = DriveApp.getFileById(fid).getBlob();
      const im = ImagesService.openImage(blob0);
      const w = im.getWidth();
      const h = im.getHeight();
      if (w && h) isLandscape = (w >= h);
    } catch (e) {
      // kalau gagal baca dimensi, anggap portrait agar aman muat 2 kolom
      isLandscape = false;
    }

    if (isLandscape) {
      // flush portrait pending dulu agar urutan tetap
      if (pendingPortraitId) {
        index = _insertPhotoRow2ColsNoCaption_(body, index, contentW, cellW, portraitImgW, pendingPortraitId, null);
        pendingPortraitId = null;
      }
      index = _insertPhotoRow1ColNoCaption_(body, index, contentW, landscapeImgW, fid);
    } else {
      if (!pendingPortraitId) {
        pendingPortraitId = fid;
      } else {
        index = _insertPhotoRow2ColsNoCaption_(body, index, contentW, cellW, portraitImgW, pendingPortraitId, fid);
        pendingPortraitId = null;
      }
    }
  }

  // sisa portrait ganjil
  if (pendingPortraitId) {
    index = _insertPhotoRow2ColsNoCaption_(body, index, contentW, cellW, portraitImgW, pendingPortraitId, null);
  }

  return index;
}

/***************
 * PAGE LAYOUT HELPER (AUTO FIT MARGIN)
 ***************/
function _getContentLayout_(doc) {
  const DEFAULT_PAGE_W = 595.28; // A4 pt
  const DEFAULT_MARGIN = 72;

  let pageW = DEFAULT_PAGE_W;
  let marginL = DEFAULT_MARGIN;
  let marginR = DEFAULT_MARGIN;

  try {
    const attrs = doc.getBody().getAttributes();
    const pw = attrs[DocumentApp.Attribute.PAGE_WIDTH];
    const ml = attrs[DocumentApp.Attribute.MARGIN_LEFT];
    const mr = attrs[DocumentApp.Attribute.MARGIN_RIGHT];

    if (typeof pw === "number") pageW = pw;
    if (typeof ml === "number") marginL = ml;
    if (typeof mr === "number") marginR = mr;
  } catch (e) {}

  let contentW = pageW - marginL - marginR;
  // Mode template: jangan dipersempit, biar lebar tabel konsisten dengan layout template
  const SAFE_PAD = 0;
  contentW = Math.max(300, contentW - SAFE_PAD);

  return { pageW, marginL, marginR, contentWidth: Math.floor(contentW) };
}

/***************
 * STYLE HELPERS (digunakan ulang)
 ***************/
function _resizeKeepRatio_(inlineImage, targetWidth) {
  const w = inlineImage.getWidth();
  const h = inlineImage.getHeight();
  if (!w || !h) {
    inlineImage.setWidth(targetWidth);
    return;
  }
  const ratio = h / w;
  inlineImage.setWidth(targetWidth);
  inlineImage.setHeight(Math.round(targetWidth * ratio));
}

function _setTableWidth_(table, width) {
  try { table.setWidth(width); } catch (e) {}
}

function _makeTableBorderlessSoft_(table) {
  // coba nolkan border
  try { table.setBorderWidth(0); } catch (e) {}
  // fallback: putih
  try { table.setBorderColor("#FFFFFF"); } catch (e) {}

  try {
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        try { cell.setBorderWidth(0); } catch (e) {}
        try { cell.setBorderColor("#FFFFFF"); } catch (e) {}
      }
    }
  } catch (e) {}
}

function _forceRowWidths_(row, widths) {
  try {
    const n = row.getNumCells();
    for (let i = 0; i < n && i < widths.length; i++) {
      try { row.getCell(i).setWidth(widths[i]); } catch (e) {}
    }
  } catch (e) {}
}

function _styleHeaderCell_(cell, width) {
  try { cell.setWidth(width); } catch (e) {}
  cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
  const p = cell.getChild(0).asParagraph();
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  p.setBold(true);
}

function _styleBodyCellCenter_(cell, width) {
  try { cell.setWidth(width); } catch (e) {}
  cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
  const p = cell.getChild(0).asParagraph();
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

function _styleBodyCellLeft_(cell, width) {
  try { cell.setWidth(width); } catch (e) {}
  cell.setVerticalAlignment(DocumentApp.VerticalAlignment.MIDDLE);
  const p = cell.getChild(0).asParagraph();
  p.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
}

function _setCellParagraphBold_(cell, isBold) {
  try {
    const p = cell.getChild(0).asParagraph();
    p.setBold(!!isBold);
  } catch (e) {}
}

function _insertPhotoRow1ColNoCaption_(body, index, contentW, imgW, fileId) {
  // 1x1 table borderless agar blok gambar rapi & center
  const t = body.insertTable(index, [[""]]);
  _setTableWidth_(t, contentW);
  _makeTableBorderless_(t);

  const cell = t.getCell(0, 0);
  _appendImageIntoCell_(cell, fileId, imgW);

  index++;
  return _insertSpacer_(body, index, 6);
}

function _insertPhotoRow2ColsNoCaption_(body, index, contentW, cellW, imgW, leftId, rightId) {
  // 1x2 table borderless agar 2 portrait sejajar
  const t = body.insertTable(index, [["", ""]]);
  _setTableWidth_(t, contentW);
  _makeTableBorderless_(t);

  const c0 = t.getCell(0, 0);
  const c1 = t.getCell(0, 1);

  try { c0.setWidth(cellW); } catch (e) {}
  try { c1.setWidth(cellW); } catch (e) {}

  if (leftId) _appendImageIntoCell_(c0, leftId, imgW);
  if (rightId) _appendImageIntoCell_(c1, rightId, imgW);
  if (!rightId) {
    try { c1.clear(); } catch (e) {}
  }

  index++;
  return _insertSpacer_(body, index, 6);
}

function _appendImageIntoCell_(cell, fileId, targetW) {
  try { cell.clear(); } catch (e) {}

  // Buat 1 paragraf kosong untuk anchor + center
  const p = cell.appendParagraph("");
  p.setSpacingBefore(0);
  p.setSpacingAfter(0);
  p.setLineSpacing(1.0);
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Inline image (lebih mudah di-center dan stabil di flow dokumen)
  const blob = DriveApp.getFileById(fileId).getBlob();
  const img = p.appendInlineImage(blob);

  _resizeKeepRatio_(img, targetW);

  // Kurangi padding cell (kalau supported)
  _tryTightenCellPadding_(cell);
}

function _makeTableBorderless_(table) {
  try { table.setBorderWidth(0); } catch (e) {}
  try {
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        try { cell.setBorderWidth(0); } catch (e) {}
      }
    }
  } catch (e) {}
}

function _tryTightenCellPadding_(cell) {
  try {
    const attrs = {};
    attrs[DocumentApp.Attribute.PADDING_TOP] = 0;
    attrs[DocumentApp.Attribute.PADDING_BOTTOM] = 0;
    attrs[DocumentApp.Attribute.PADDING_LEFT] = 0;
    attrs[DocumentApp.Attribute.PADDING_RIGHT] = 0;
    cell.setAttributes(attrs);
  } catch (e) {}
}

function _insertPhotoRow1Col_(body, index, contentW, fileId, caption, targetW) {
  const t = body.insertTable(index, [[""]]);
  _setTableWidth_(t, contentW);
  _makeTableBorderless_(t);

  const cell = t.getCell(0, 0);
  _fillPhotoCellPacked_(cell, caption, fileId, targetW);

  index++;
  return _insertSpacer_(body, index, 6);
}

function _insertPhotoRow2Cols_(body, index, contentW, cellW, imgW, left, right) {
  const t = body.insertTable(index, [["", ""]]);
  _setTableWidth_(t, contentW);
  _makeTableBorderless_(t);

  const c0 = t.getCell(0, 0);
  const c1 = t.getCell(0, 1);
  try { c0.setWidth(cellW); } catch (e) {}
  try { c1.setWidth(cellW); } catch (e) {}

  if (left) _fillPhotoCellPacked_(c0, left.caption, left.fid, imgW);
  if (right) _fillPhotoCellPacked_(c1, right.caption, right.fid, imgW);
  if (!right) {
    try { c1.clear(); } catch (e) {}
  }

  index++;
  return _insertSpacer_(body, index, 6);
}

// Ini kunci anti "caption page 1, gambar page 2":
// caption + newline + image dalam SATU PARAGRAF
function _fillPhotoCellPacked_(cell, caption, fileId, targetW) {
  try { cell.clear(); } catch (e) {}

  const p = cell.appendParagraph("");
  p.setSpacingBefore(0);
  p.setSpacingAfter(0);
  p.setLineSpacing(1.0);
  p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const t = p.appendText(caption + "\n");
  t.setItalic(true);
  t.setFontSize(9);

  const blob = DriveApp.getFileById(fileId).getBlob();
  const img = p.appendInlineImage(blob);
  _resizeKeepRatio_(img, targetW);

  _tryTightenCellPadding_(cell);
}

function _makeTableBorderless_(table) {
  try { table.setBorderWidth(0); } catch (e) {}
  try {
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      for (let c = 0; c < row.getNumCells(); c++) {
        const cell = row.getCell(c);
        try { cell.setBorderWidth(0); } catch (e) {}
      }
    }
  } catch (e) {}
}

function _tryTightenCellPadding_(cell) {
  try {
    const attrs = {};
    attrs[DocumentApp.Attribute.PADDING_TOP] = 0;
    attrs[DocumentApp.Attribute.PADDING_BOTTOM] = 0;
    attrs[DocumentApp.Attribute.PADDING_LEFT] = 0;
    attrs[DocumentApp.Attribute.PADDING_RIGHT] = 0;
    cell.setAttributes(attrs);
  } catch (e) {}
}


/***************
 * FORMATTERS (Tanggal/Waktu Indonesia)
 ***************/
function _formatTanggalIndo_(dateVal) {
  try {
    let dt;
    if (Object.prototype.toString.call(dateVal) === "[object Date]") {
      dt = dateVal;
    } else {
      const s = String(dateVal || "").trim();
      const parts = s.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        dt = new Date(y, m - 1, d);
      } else {
        dt = new Date(s);
      }
    }
    if (!dt || isNaN(dt.getTime())) return String(dateVal || "");

    const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][dt.getDay()];
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][dt.getMonth()];
    const d = dt.getDate();
    const y = dt.getFullYear();
    return `${hari}, ${d} ${bulan} ${y}`;
  } catch (e) {
    return String(dateVal || "");
  }
}

function _normTime_(t) {
  const s = String(t || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const hh = String(parseInt(m[1], 10)).padStart(2, "0");
  return `${hh}:${m[2]}`;
}

function _formatTimeVal_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, "Asia/Jakarta", "HH:mm");
  }
  return _normTime_(v);
}

function _formatWaktuIndo_(startVal, endVal) {
  const s = _formatTimeVal_(startVal);
  const e = _formatTimeVal_(endVal);
  if (s && e) return `${s} - ${e} (WIB)`;
  if (s && !e) return `${s} (WIB)`;
  return "-";
}

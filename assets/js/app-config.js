/******************************
 * GABKU APP - GLOBAL CONFIG
 ******************************/

const APP_CONFIG = {
  name: "Gabku App",
  shortName: "Gabku",
  version: "1.0.0",

  // Branding
  logo: "assets/icons/logo-blue.png", // sesuaikan dengan nama file kamu
  themeColor: "#1e88e5",

  // UI
  toastDuration: 2000,
  defaultTitle: "Gabku App",

  // Feature flags (V1 → V1.1 → V2)
  features: {
    exportCSV: true,
    exportPDF: true,
    pwaInstall: false, // nanti kita nyalakan di tahap PWA
  }
};

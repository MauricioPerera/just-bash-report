/**
 * Internationalization for rendered output.
 *
 * Default locale is "es" (matches v1.x behavior). Pass --locale=en at the
 * command level, or { locale: "en" } to createReportPlugin, to switch.
 */

export type Locale = "en" | "es";

export interface Strings {
  htmlLang: string;
  searchPlaceholder: string;
  records: string;
  generated: string;
  generatedFooter: string;
  // auto dashboard headings
  totalRecords: string;
  byField: (field: string) => string;
  fieldAvg: (field: string) => string;
  fieldTotal: (field: string) => string;
  fieldByMonth: (field: string) => string;
  collectionData: (collection: string) => string;
  // site
  defaultSiteTitle: string;
  home: string;
  backToHome: string;
  byAuthor: (author: string) => string;
  // invoice
  invoiceTitle: string;
  invoiceFrom: string;
  invoiceTo: string;
  invoiceDate: string;
  invoiceDueDate: string;
  invoiceDescription: string;
  invoiceQuantity: string;
  invoiceUnitPrice: string;
  invoiceSubtotal: string;
  invoiceTotal: string;
  invoicePaymentInfo: string;
  invoiceNotes: string;
  invoiceTaxId: string;
  invoiceStatus: Record<"draft" | "sent" | "paid" | "overdue", string>;
}

const ES: Strings = {
  htmlLang: "es",
  searchPlaceholder: "Buscar...",
  records: "registros",
  generated: "Generado:",
  generatedFooter: "Generado automáticamente por just-bash-report",
  totalRecords: "Total Registros",
  byField: (field) => `Por ${field}`,
  fieldAvg: (field) => `${field} (promedio)`,
  fieldTotal: (field) => `${field} (total)`,
  fieldByMonth: (field) => `${field} por mes`,
  collectionData: (c) => `Datos: ${c}`,
  defaultSiteTitle: "Mi Sitio",
  home: "Inicio",
  backToHome: "← Volver al inicio",
  byAuthor: (a) => `Por ${a}`,
  invoiceTitle: "FACTURA",
  invoiceFrom: "De",
  invoiceTo: "Para",
  invoiceDate: "Fecha:",
  invoiceDueDate: "Vencimiento:",
  invoiceDescription: "Descripción",
  invoiceQuantity: "Cant.",
  invoiceUnitPrice: "Precio Unit.",
  invoiceSubtotal: "Subtotal",
  invoiceTotal: "Total",
  invoicePaymentInfo: "Información de Pago",
  invoiceNotes: "Notas",
  invoiceTaxId: "RFC",
  invoiceStatus: {
    draft: "Borrador",
    sent: "Enviada",
    paid: "Pagada",
    overdue: "Vencida",
  },
};

const EN: Strings = {
  htmlLang: "en",
  searchPlaceholder: "Search...",
  records: "records",
  generated: "Generated:",
  generatedFooter: "Generated automatically by just-bash-report",
  totalRecords: "Total Records",
  byField: (field) => `By ${field}`,
  fieldAvg: (field) => `${field} (average)`,
  fieldTotal: (field) => `${field} (total)`,
  fieldByMonth: (field) => `${field} by month`,
  collectionData: (c) => `Data: ${c}`,
  defaultSiteTitle: "My Site",
  home: "Home",
  backToHome: "← Back to home",
  byAuthor: (a) => `By ${a}`,
  invoiceTitle: "INVOICE",
  invoiceFrom: "From",
  invoiceTo: "To",
  invoiceDate: "Date:",
  invoiceDueDate: "Due:",
  invoiceDescription: "Description",
  invoiceQuantity: "Qty",
  invoiceUnitPrice: "Unit Price",
  invoiceSubtotal: "Subtotal",
  invoiceTotal: "Total",
  invoicePaymentInfo: "Payment Information",
  invoiceNotes: "Notes",
  invoiceTaxId: "Tax ID",
  invoiceStatus: {
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
  },
};

export function getStrings(locale?: Locale): Strings {
  return locale === "en" ? EN : ES;
}

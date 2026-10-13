import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ExportTransaction {
  transaction_date: string;
  type: string;
  category: string;
  description: string | null;
  amount: number;
}

const formatAmount = (amount: number) =>
  amount.toLocaleString('fr-FR') + ' Ar';

const formatDate = (date: string) =>
  format(parseISO(date), 'd MMMM yyyy', { locale: fr });

export const exportCSV = (transactions: ExportTransaction[], filename = 'transactions') => {
  const header = 'Date,Type,Catégorie,Description,Montant';
  const rows = transactions.map((tx) =>
    [
      tx.transaction_date,
      tx.type === 'income' ? 'Revenu' : 'Dépense',
      tx.category,
      `"${(tx.description ?? '').replace(/"/g, '""')}"`,
      tx.amount,
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

export const exportPDF = (
  transactions: ExportTransaction[],
  filters: { type?: string; period?: string },
  filename = 'transactions'
) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('Tsinjo — Transactions', 14, 20);

  // Filters info
  doc.setFontSize(10);
  const filterParts: string[] = [];
  if (filters.type && filters.type !== 'all')
    filterParts.push(`Type: ${filters.type === 'income' ? 'Revenus' : 'Dépenses'}`);
  if (filters.period && filters.period !== 'all')
    filterParts.push(`Période: ${filters.period}`);
  if (filterParts.length)
    doc.text(filterParts.join(' | '), 14, 28);

  doc.text(`Exporté le ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 14, filterParts.length ? 34 : 28);

  // Table
  autoTable(doc, {
    startY: filterParts.length ? 40 : 34,
    head: [['Date', 'Type', 'Catégorie', 'Description', 'Montant']],
    body: transactions.map((tx) => [
      formatDate(tx.transaction_date),
      tx.type === 'income' ? 'Revenu' : 'Dépense',
      tx.category,
      tx.description ?? '',
      formatAmount(tx.amount),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241] },
  });

  doc.save(`${filename}.pdf`);
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

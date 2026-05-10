import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateServiceFaitPDF(data) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 10;

  // ============ ENTÊTE ============
  // Logo/Header background
  doc.setFillColor(30, 41, 59); // #1e293b
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Titre
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('ATTESTATION DE SERVICE FAIT', pageWidth / 2, 12, { align: 'center' });

  // Infos entreprise
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('ZETA CONCEPT - Bureau d\'études techniques', pageWidth / 2, 20, { align: 'center' });
  doc.text('App 4, Log 287 - Bd Med V - Tinghir (M)', pageWidth / 2, 24, { align: 'center' });
  doc.text('RC: XXXXX | ICE: 0022XXXXX | Tel: +212 5 24 88 05 71', pageWidth / 2, 28, { align: 'center' });

  yPosition = 40;

  // ============ INFORMATIONS GÉNÉRALES ============
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('Informations de l\'Attestation', 14, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');

  // Deux colonnes
  const leftX = 14;
  const rightX = pageWidth / 2 + 5;
  const lineHeight = 6;

  doc.text(`Numéro de l'objet de marché:`, leftX, yPosition);
  doc.setFont(undefined, 'bold');
  doc.text(data.numero_objet_marche || 'N/A', leftX + 50, yPosition);
  yPosition += lineHeight;

  doc.setFont(undefined, 'normal');
  doc.text(`Nom du Prestataire:`, leftX, yPosition);
  doc.setFont(undefined, 'bold');
  doc.text(data.nom_prestataire || 'ZETA CONCEPT', leftX + 50, yPosition);
  yPosition += lineHeight;

  doc.setFont(undefined, 'normal');
  doc.text(`Lieu d'édition:`, leftX, yPosition);
  doc.setFont(undefined, 'bold');
  doc.text(data.lieu_edition || 'Tinghir', leftX + 50, yPosition);
  yPosition += lineHeight;

  doc.setFont(undefined, 'normal');
  doc.text(`Date d'édition:`, leftX, yPosition);
  doc.setFont(undefined, 'bold');
  doc.text(
    data.date_edition ? new Date(data.date_edition).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    leftX + 50,
    yPosition
  );
  yPosition += lineHeight + 2;

  // Colonne droite
  let rightY = 40;
  doc.setFont(undefined, 'normal');
  doc.text(`Période d'exécution:`, rightX, rightY);
  doc.setFont(undefined, 'bold');
  const dateDebut = data.date_debut ? new Date(data.date_debut).toLocaleDateString('fr-FR') : 'N/A';
  const dateFin = data.date_fin ? new Date(data.date_fin).toLocaleDateString('fr-FR') : 'N/A';
  doc.text(`Du ${dateDebut} au ${dateFin}`, rightX + 40, rightY);
  rightY += lineHeight;

  if (data.client) {
    doc.setFont(undefined, 'normal');
    doc.text(`Client:`, rightX, rightY);
    doc.setFont(undefined, 'bold');
    doc.text(data.client.nom || 'N/A', rightX + 40, rightY);
    rightY += lineHeight;
  }

  if (data.projet) {
    doc.setFont(undefined, 'normal');
    doc.text(`Projet:`, rightX, rightY);
    doc.setFont(undefined, 'bold');
    doc.text(data.projet.titre || 'N/A', rightX + 40, rightY);
    rightY += lineHeight;
  }

  yPosition = Math.max(yPosition, rightY + 2);

  // ============ TABLEAU PRESTATIONS ============
  yPosition += 4;
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Détails des Prestations', 14, yPosition);
  yPosition += 8;

  const tableData = [];
  let totalHT = 0;
  let montantTVA = 0;

  if (data.prestations && data.prestations.length > 0) {
    data.prestations.forEach((prestation, idx) => {
      const prixHT = parseFloat(prestation.prix_ht || 0);
      totalHT += prixHT;

      tableData.push([
        idx + 1,
        prestation.description || '',
        prestation.unite || '',
        (prestation.qte_mois || 0).toString(),
        `${(parseFloat(prestation.pu_ht) || 0).toLocaleString('fr-FR')}`,
        `${prixHT.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`,
      ]);
    });
  } else {
    tableData.push([
      1,
      'Prestation de services techniques',
      'Forfait',
      '1',
      '0,00',
      '0,00',
    ]);
  }

  montantTVA = (totalHT * (data.tva_pourcent || 20)) / 100;
  const totalTTC = totalHT + montantTVA;

  autoTable(doc, {
    startY: yPosition,
    head: [['N°', 'Description', 'Unité', 'Qté (mois)', 'P.U HT', 'Prix HT (MAD)']],
    body: tableData,
    foot: [
      ['', '', '', '', 'TOTAL HT:', `${totalHT.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`],
      ['', '', '', '', `TVA ${data.tva_pourcent || 20}%:`, `${montantTVA.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`],
      ['', '', '', '', 'TOTAL TTC:', `${totalTTC.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`],
    ],
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 70 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 28 },
    },
  });

  yPosition = doc.lastAutoTable.finalY + 10;

  // ============ NOTES ============
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Observations:', 14, yPosition);
    yPosition += 5;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 28);
    doc.text(notesLines, 14, yPosition);
    yPosition += notesLines.length * 4 + 5;
  }

  // ============ SIGNATURE & CACHET ============
  yPosition = pageHeight - 35;

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Signature et Cachet du Prestataire', 14, yPosition);
  yPosition += 4;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text('Date de signature:', 14, yPosition);
  doc.text('_________________________', 14, yPosition + 8);
  yPosition += 12;

  doc.text('Signature:', 14, yPosition);
  doc.text('_________________________', 14, yPosition + 8);
  yPosition += 12;

  doc.text('Cachet/Tampon:', 14, yPosition);
  doc.rect(14, yPosition + 2, 40, 30, 'S'); // Cachet placeholder

  // Colonne droite signature client
  yPosition = pageHeight - 35;
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Signature et Cachet du Client', pageWidth / 2 + 20, yPosition);
  yPosition += 4;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text('Date de réception:', pageWidth / 2 + 20, yPosition);
  doc.text('_________________________', pageWidth / 2 + 20, yPosition + 8);
  yPosition += 12;

  doc.text('Signature:', pageWidth / 2 + 20, yPosition);
  doc.text('_________________________', pageWidth / 2 + 20, yPosition + 8);
  yPosition += 12;

  doc.text('Cachet/Tampon:', pageWidth / 2 + 20, yPosition);
  doc.rect(pageWidth / 2 + 20, yPosition + 2, 40, 30, 'S'); // Cachet placeholder

  // ============ FOOTER ============
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Document généré par PLANORA - ${new Date().toLocaleString('fr-FR')}`,
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  );

  // ============ TÉLÉCHARGER ============
  const filename = `ServiceFait_${data.numero_objet_marche}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

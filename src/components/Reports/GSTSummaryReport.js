import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useTableSort, SortableHeader } from '../../utils/tableSort';
import { useTablePagination } from '../../utils/tablePagination';
import PaginationControls from '../../utils/PaginationControls';
import ShareButton from './ShareButton';
import { exportTableAsPDF, exportTableAsExcel, exportTableAsImage, shareLink } from './exportUtils';

const GSTSummaryReport = ({ db, userId, appId, dateRange, financialYear, selectedParty, parties, loading, setLoading, companyDetails, forcedGstType, reportTypeDefault }) => {
  const [gstData, setGstData] = useState([]);
  const [rawSales, setRawSales] = useState([]);
  const [itemMap, setItemMap] = useState({});
  const [reportType, setReportType] = useState(reportTypeDefault || 'gstr1'); // gstr1 or gstr3b
  const [invoiceType, setInvoiceType] = useState('all'); // all, b2b, b2c, export
  const [viewMode, setViewMode] = useState('both'); // both | sales | purchases (affects gstr3b rendering)
  const [gstType, setGstType] = useState(forcedGstType || 'regular'); // regular or composition
  const [compositionRate, setCompositionRate] = useState(1); // % of turnover

  // Keep local report type in sync with parent default
  useEffect(() => {
    if (reportTypeDefault) setReportType(reportTypeDefault);
  }, [reportTypeDefault]);

  // Keep GST mode in sync when parent forces it
  useEffect(() => {
    if (forcedGstType) setGstType(forcedGstType);
  }, [forcedGstType]);

  // Initialize from company details
  useEffect(() => {
    if (!companyDetails || forcedGstType) return;
    const type = (companyDetails.gstinType || companyDetails.gstType || '').toLowerCase();
    if (type === 'composition') setGstType('composition');
    else if (type === 'regular') setGstType('regular');
    if (companyDetails.compositionRate) setCompositionRate(companyDetails.compositionRate);
  }, [companyDetails, forcedGstType]);
  const [totalSummary, setTotalSummary] = useState({
    totalInvoices: 0,
    totalTaxable: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalAmount: 0
  });

  // Table sorting and pagination
  const { sortedData, sortConfig, handleSort } = useTableSort(gstData, { key: 'date', direction: 'desc' });
  // Use filtered data for pagination in GSTR-1
  const filteredForTable = (() => {
    if (reportType !== 'gstr1') return sortedData;
    let f = [...sortedData];
    if (viewMode === 'sales') f = f.filter(r => r.recordType === 'outward');
    else if (viewMode === 'purchases') f = f.filter(r => r.recordType === 'inward');
    if (selectedParty) f = f.filter(r => r.partyId === selectedParty);
    if (invoiceType !== 'all') f = f.filter(r => r.invoiceType === invoiceType);
    return f;
  })();
  const pagination = useTablePagination(filteredForTable, 25);

  // Top/bottom horizontal scrollbar sync
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [tableWidth, setTableWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) setTableWidth(tableRef.current.scrollWidth || 0);
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined' && tableRef.current) {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(tableRef.current);
      return () => ro.disconnect();
    }
  }, [sortedData, reportType]);

  useEffect(() => {
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!top || !bottom) return;
    const onTop = () => { bottom.scrollLeft = top.scrollLeft; };
    const onBottom = () => { top.scrollLeft = bottom.scrollLeft; };
    top.addEventListener('scroll', onTop);
    bottom.addEventListener('scroll', onBottom);
    return () => {
      top.removeEventListener('scroll', onTop);
      bottom.removeEventListener('scroll', onBottom);
    };
  }, [tableWidth]);

  // Export helpers
  const getExportColumns = () => {
    if (reportType === 'gstr1') {
      const cols = [
        { key: 'date', label: 'Date' },
        { key: 'docNo', label: 'Invoice No' },
        { key: 'partyName', label: 'Party' },
        { key: 'invoiceType', label: 'Type' },
        { key: 'gstPercent', label: 'GST %' },
        { key: 'totalGST', label: 'GST Amount' },
        { key: 'taxable', label: 'Taxable' },
        { key: 'cgst', label: 'CGST' },
        { key: 'sgst', label: 'SGST' }
      ];
      if (gstType === 'regular') cols.push({ key: 'igst', label: 'IGST' });
      cols.push({ key: 'total', label: gstType === 'regular' ? 'Total' : 'Total (Taxable)' });
      return cols;
    }
    const cols = [
      { key: 'type', label: 'Type' },
      { key: 'taxable', label: 'Taxable' },
      { key: 'cgst', label: 'CGST' },
      { key: 'sgst', label: 'SGST' }
    ];
    if (gstType === 'regular') cols.push({ key: 'igst', label: 'IGST' });
    cols.push({ key: 'net', label: gstType === 'regular' ? 'Net Tax' : 'Composition Tax' });
    return cols;
  };

  const buildExportRows = () => {
    // Flatten rows for export: use displayData for GSTR-1, or show GSTR-3B summary
    if (reportType === 'gstr1') {
      const rows = [];
      displayData.forEach(r => {
        // main row
        rows.push({
          date: formatDate(r.date),
          docNo: r.docNo,
          partyName: r.partyName,
          invoiceType: gstType === 'composition' ? 'BOS' : r.invoiceType,
          gstPercent: r.gstPercent != null ? `${(r.gstPercent||0).toFixed(2)}%` : '',
          totalGST: r.totalGST,
          taxable: r.taxable,
          cgst: gstType === 'composition' ? (r.totalGST/2) : r.cgst,
          sgst: gstType === 'composition' ? (r.totalGST/2) : r.sgst,
          igst: gstType === 'composition' ? 0 : r.igst,
          total: gstType === 'composition' ? r.taxable : r.total
        });
        // sub-rows (rate splits)
        if (Array.isArray(r.children) && r.children.length > 0) {
          r.children.forEach(c => {
            const rate = Number(c.rate || 0);
            const taxable = Number(c.taxable || 0);
            const subTotalGST = gstType === 'composition' ? (taxable * rate / 100) : (Number(c.totalGST || 0));
            const subCgst = gstType === 'composition' ? (subTotalGST / 2) : Number(c.cgst || 0);
            const subSgst = gstType === 'composition' ? (subTotalGST / 2) : Number(c.sgst || 0);
            const subIgst = gstType === 'composition' ? 0 : Number(c.igst || 0);
            rows.push({
              _isSub: true,
              date: '',
              docNo: '',
              partyName: '',
              invoiceType: '',
              gstPercent: `${rate.toFixed(2)}%`,
              totalGST: subTotalGST,
              taxable: taxable,
              cgst: subCgst,
              sgst: subSgst,
              igst: subIgst,
              total: gstType === 'composition' ? taxable : taxable + subTotalGST
            });
          });
        }
      });
      // Totals row
      const totals = rows.filter(r => !r._isSub).reduce((acc, r) => ({
        totalGST: acc.totalGST + (parseFloat(r.totalGST)||0),
        taxable: acc.taxable + (parseFloat(r.taxable)||0),
        cgst: acc.cgst + (parseFloat(r.cgst)||0),
        sgst: acc.sgst + (parseFloat(r.sgst)||0),
        igst: acc.igst + (parseFloat(r.igst)||0),
        total: acc.total + (parseFloat(r.total)||0)
      }), { totalGST:0, taxable:0, cgst:0, sgst:0, igst:0, total:0 });
      rows.push({ date: '', docNo: '', partyName: 'TOTAL', invoiceType: '', gstPercent: '', ...totals });
      return rows;
    }
    // GSTR-3B summary export
    const rows = [];
    // Outward main row
    rows.push({ type: 'Outward', taxable: gstr3bSummary.outward.taxable, cgst: gstr3bSummary.outward.cgst, sgst: gstr3bSummary.outward.sgst, igst: gstType==='regular'?gstr3bSummary.outward.igst:0, net: gstType==='regular' ? (gstr3bSummary.outward.cgst+gstr3bSummary.outward.sgst+gstr3bSummary.outward.igst) : gstr3bSummary.netPayable.composition });
    // Outward sub-rows (both modes)
    if (Array.isArray(gstr3bSummary.rateBreakdown?.outward)) {
      gstr3bSummary.rateBreakdown.outward.forEach(rb => {
        rows.push({ _isSub: true, type: `${(rb.rate||0).toFixed(2)}%`, taxable: rb.taxable, cgst: gstType==='composition'? rb.tax/2 : (rb.cgst||0), sgst: gstType==='composition'? rb.tax/2 : (rb.sgst||0), igst: gstType==='regular' ? (rb.igst||0) : 0, net: gstType==='composition' ? rb.tax : ((rb.cgst||0)+(rb.sgst||0)+(rb.igst||0)) });
      });
    }
    // Inward main row
    rows.push({ type: 'Inward ITC', taxable: gstr3bSummary.inward.taxable, cgst: gstr3bSummary.inward.cgst, sgst: gstr3bSummary.inward.sgst, igst: gstType==='regular'?gstr3bSummary.inward.igst:0, net: gstType==='regular' ? (gstr3bSummary.inward.cgst+gstr3bSummary.inward.sgst+gstr3bSummary.inward.igst) : 0 });
    // Inward sub-rows (both modes)
    if (Array.isArray(gstr3bSummary.rateBreakdown?.inward)) {
      gstr3bSummary.rateBreakdown.inward.forEach(rb => {
        rows.push({ _isSub: true, type: `${(rb.rate||0).toFixed(2)}%`, taxable: rb.taxable, cgst: gstType==='composition'? rb.tax/2 : (rb.cgst||0), sgst: gstType==='composition'? rb.tax/2 : (rb.sgst||0), igst: gstType==='regular' ? (rb.igst||0) : 0, net: gstType==='composition' ? rb.tax : ((rb.cgst||0)+(rb.sgst||0)+(rb.igst||0)) });
      });
    }
    const totals = rows.reduce((acc,r)=>({
      taxable: acc.taxable + (r._isSub ? 0 : (parseFloat(r.taxable)||0)),
      cgst: acc.cgst + (r._isSub ? 0 : (parseFloat(r.cgst)||0)),
      sgst: acc.sgst + (r._isSub ? 0 : (parseFloat(r.sgst)||0)),
      igst: acc.igst + (r._isSub ? 0 : (parseFloat(r.igst)||0)),
      net: acc.net + (r._isSub ? 0 : (parseFloat(r.net)||0))
    }), {taxable:0,cgst:0,sgst:0,igst:0,net:0});
    rows.push({ type:'TOTAL', ...totals });
    return rows;
  };

  const exportPDF = () => {
    const columns = getExportColumns();
    exportTableAsPDF({
      data: buildExportRows(),
      columns,
      filename: `GST-${reportType}-${gstType}-${new Date().toISOString().slice(0,10)}`,
      title: reportType === 'gstr1' ? 'GSTR-1' : (gstType==='regular' ? 'GSTR-3B' : 'Composition Summary'),
      companyDetails,
      reportDetails: { Period: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}` }
    });
  };

  const exportExcel = () => {
    const columns = getExportColumns();
    exportTableAsExcel({
      data: buildExportRows(),
      columns,
      filename: `GST-${reportType}-${gstType}-${new Date().toISOString().slice(0,10)}`,
      companyDetails,
      reportDetails: { Period: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}` }
    });
  };

  const exportImage = () => {
    const columns = getExportColumns();
    exportTableAsImage({
      data: buildExportRows(),
      columns,
      filename: `GST-${reportType}-${gstType}-${new Date().toISOString().slice(0,10)}`,
      companyDetails,
      reportDetails: { Period: `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}` }
    });
  };

  // Print with letterhead and table
  const printReport = () => {
    const cols = getExportColumns();
    const rows = buildExportRows();
    const w = window.open('', 'PRINT', 'height=700,width=900');
    const headerHtml = `
      <div style="text-align:center;margin-bottom:8px;border-bottom:2px solid #333;padding-bottom:8px;">
        <div style="font-size:20px;font-weight:bold;">${companyDetails?.firmName || 'Company Name'}</div>
        <div style="font-size:12px;color:#555;">${companyDetails?.address || ''}</div>
        <div style="font-size:12px;color:#555;">${companyDetails?.gstin ? `GSTIN: ${companyDetails.gstin}` : ''}${companyDetails?.contactNumber ? ` | Phone: ${companyDetails.contactNumber}` : ''}</div>
      </div>`;
    const title = reportType === 'gstr1' ? 'GSTR-1' : (gstType==='regular' ? 'GSTR-3B' : 'Composition Summary');
    const tableHead = `<tr>${cols.map(c=>`<th style=\"border:1px solid #ddd;padding:6px;text-align:${c.key==='type'||c.key==='partyName'||c.key==='docNo'?'left':'right'};\">${c.label}</th>`).join('')}</tr>`;
    const bodyRows = rows.map(r=>`<tr style=\"${r._isSub ? 'font-size:12px;background:#fafafa;' : ''}\">${cols.map(c=>{
      const v = r[c.key];
      const isNum = typeof v === 'number';
      const display = isNum ? v.toLocaleString('en-IN') : (v||'');
      return `<td style=\"border:1px solid #ddd;padding:6px;text-align:${isNum?'right':'left'};${r._isSub && (c.key==='date' || c.key==='docNo' || c.key==='partyName' || c.key==='invoiceType') ? 'color:#888;' : ''}\">${display}</td>`;
    }).join('')}</tr>`).join('');
    w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px} th{background:#f6f6f6}</style></head><body>${headerHtml}<h3 style="text-align:center;margin:0 0 12px;">${title}</h3><div style="margin-bottom:8px;">Period: ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}</div><table><thead>${tableHead}</thead><tbody>${bodyRows}</tbody></table></body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>{ w.print(); w.close(); }, 300);
  };

  // Invoice summary modal
  const [billModal, setBillModal] = useState(null); // { id, type: 'outward'|'inward' }
  const [billDetails, setBillDetails] = useState(null);
  useEffect(() => {
    const load = async () => {
      if (!billModal) return;
      try {
        const coll = billModal.type === 'outward' ? 'salesBills' : 'purchaseBills';
        const ref = doc(db, `artifacts/${appId}/users/${userId}/${coll}`, billModal.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          const rows = data.rows || data.items || [];
          const enriched = [];
          for (const r of rows) {
            let name = r.description || (itemMap[r.item]?.name);
            if (!name && r.item) {
              try {
                const itemRef = doc(db, `artifacts/${appId}/users/${userId}/items`, r.item);
                const itemSnap = await getDoc(itemRef);
                if (itemSnap.exists()) name = itemSnap.data().itemName || name;
              } catch {}
            }
            enriched.push({ ...r, _displayName: name || 'Item' });
          }
          setBillDetails({ ...data, _enrichedRows: enriched });
        }
      } catch (e) {
        setBillDetails(null);
      }
    };
    load();
  }, [billModal, db, appId, userId, itemMap]);

  // Close invoice summary with ESC key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setBillDetails(null);
        setBillModal(null);
      }
    };
    if (billModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [billModal]);

  // Fetch GST data
  useEffect(() => {
    const fetchGSTReport = async () => {
      if (!db || !userId || !appId) return;
      
      setLoading(true);
      try {
        const startStr = new Date(dateRange.start).toISOString().split('T')[0];
        const endStr = new Date(dateRange.end).toISOString().split('T')[0];
        // Get all sales in date range
        const salesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/salesBills`),
          where('invoiceDate', '>=', startStr),
          where('invoiceDate', '<=', endStr),
          orderBy('invoiceDate', 'desc')
        );

        const salesSnapshot = await getDocs(salesQuery);
        let sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          sales = sales.filter(sale => sale.partyId === selectedParty);
        }

        // Get all purchases in date range
        const purchasesQuery = query(
          collection(db, `artifacts/${appId}/users/${userId}/purchaseBills`),
          where('billDate', '>=', startStr),
          where('billDate', '<=', endStr),
          orderBy('billDate', 'desc')
        );

        const purchasesSnapshot = await getDocs(purchasesQuery);
        let purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch items for tax rates and HSN
        const itemsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/items`));
        const itemMeta = {};
        itemsSnapshot.forEach(d => {
          const it = d.data() || {};
          itemMeta[d.id] = {
            gstPercentage: parseFloat(it.gstPercentage) || 0,
            compositionGstRate: parseFloat(it.compositionGstRate) || 0,
            itemType: it.itemType || 'Goods',
            hsnCode: it.hsnCode || ''
          };
        });
        setItemMap(itemMeta);

        // Filter by selected party in JavaScript if needed
        if (selectedParty) {
          purchases = purchases.filter(purchase => purchase.partyId === selectedParty);
        }

        // Group line items by effective rate (from row or item master)
        const groupByRate = (rows, isComposition) => {
          const list = Array.isArray(rows) ? rows : [];
          const groups = new Map();
          for (const r of list) {
            const base = parseFloat(r.amount) || 0;
            const meta = itemMeta[r.item] || {};
            const regularRate = (parseFloat(r.sgst) || 0) + (parseFloat(r.cgst) || 0) + (parseFloat(r.igst) || 0) || meta.gstPercentage || 0;
            let compRate = meta.compositionGstRate;
            if (!compRate) compRate = meta.itemType === 'Service' ? 6 : 1; // fallback
            const rate = isComposition ? compRate : regularRate;
            let cg, sg, ig;
            if (isComposition) {
              const totalGst = (base * (rate || 0)) / 100;
              cg = totalGst / 2;
              sg = totalGst / 2;
              ig = 0;
            } else {
              cg = ((parseFloat(r.cgst) || 0) * base) / 100;
              sg = ((parseFloat(r.sgst) || 0) * base) / 100;
              ig = ((parseFloat(r.igst) || 0) * base) / 100;
            }
            if (!groups.has(rate)) groups.set(rate, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
            const g = groups.get(rate);
            g.taxable += base; g.cgst += cg; g.sgst += sg; g.igst += ig;
          }
          return groups;
        };

        // Process GST data
        const gstRecords = [];

        // Helper to resolve partyId reliably
        const resolvePartyId = (docData) => {
          const raw = docData.customFields?.party || docData.party || docData.partyId;
          if (raw && parties.some(p => p.id === raw)) return raw;
          const name = docData.partyName || docData.firmName || docData.partyFirmName || '';
          const match = parties.find(p => (p.firmName || p.partyName) === name);
          return match?.id || raw || '';
        };

        // Process sales (outward supplies)
        sales.forEach(sale => {
          const rows = sale.rows || sale.items || [];
          const groups = groupByRate(rows, gstType === 'composition');
          const partyId = resolvePartyId(sale);
          const partyObj = parties.find(p => p.id === partyId) || {};
          const partyName = sale.partyName || partyObj.firmName || partyObj.name || '';

          const isB2B = !!(partyObj.gstin && partyObj.gstin.trim() !== '');
          let taxable = 0, cgst = 0, sgst = 0, igst = 0; const children = [];
          for (const [rate, g] of groups.entries()) {
            const totalGSTChild = g.cgst + g.sgst + g.igst;
            children.push({ rate, taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: g.igst, totalGST: totalGSTChild });
            taxable += g.taxable; cgst += g.cgst; sgst += g.sgst; igst += g.igst;
          }
          const total = taxable + cgst + sgst + igst;
          const totalGST = cgst + sgst + igst;
          const mainRate = (groups.size === 1) ? Array.from(groups.keys())[0] : null;
          
          gstRecords.push({
            date: sale.invoiceDate || sale.date,
            docNo: sale.number || sale.invoiceNumber || sale.id,
            docType: 'Invoice',
            partyName,
            supplyState: partyObj?.state || '',
            invoiceType: isB2B ? 'B2B' : 'B2C',
            taxable,
            cgst,
            sgst,
            igst,
            gstPercent: mainRate,
            totalGST,
            children,
            total,
            recordType: 'outward',
            docId: sale.id,
            partyId
          });
        });

        // Process purchases (inward supplies for ITC)
        purchases.forEach(purchase => {
          const rows = purchase.rows || purchase.items || [];
          const groups = groupByRate(rows, gstType === 'composition');
          const partyId = resolvePartyId(purchase);
          const partyObj = parties.find(p => p.id === partyId) || {};
          const partyName = purchase.partyName || partyObj.firmName || partyObj.name || '';

          const isB2B = !!(partyObj.gstin && partyObj.gstin.trim() !== '');
          let taxable = 0, cgst = 0, sgst = 0, igst = 0; const children = [];
          for (const [rate, g] of groups.entries()) {
            const totalGSTChild = g.cgst + g.sgst + g.igst;
            children.push({ rate, taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: g.igst, totalGST: totalGSTChild });
            taxable += g.taxable; cgst += g.cgst; sgst += g.sgst; igst += g.igst;
          }
          const total = taxable + cgst + sgst + igst;
          const totalGST = cgst + sgst + igst;
          const mainRate = (groups.size === 1) ? Array.from(groups.keys())[0] : null;
          
          gstRecords.push({
            date: purchase.billDate || purchase.date,
            docNo: purchase.number || purchase.billNumber || purchase.id,
            docType: 'Purchase',
            partyName,
            supplyState: partyObj?.state || '',
            invoiceType: isB2B ? 'B2B' : 'B2C',
            taxable,
            cgst,
            sgst,
            igst,
            gstPercent: mainRate,
            totalGST,
            children,
            total,
            recordType: 'inward',
            docId: purchase.id,
            partyId
          });
        });

        setGstData(gstRecords);
        setRawSales(sales);

        // Calculate totals
        const totals = gstRecords.reduce((acc, record) => ({
          totalInvoices: acc.totalInvoices + 1,
          totalTaxable: acc.totalTaxable + record.taxable,
          totalCGST: acc.totalCGST + record.cgst,
          totalSGST: acc.totalSGST + record.sgst,
          totalIGST: acc.totalIGST + record.igst,
          totalAmount: acc.totalAmount + record.total
        }), {
          totalInvoices: 0,
          totalTaxable: 0,
          totalCGST: 0,
          totalSGST: 0,
          totalIGST: 0,
          totalAmount: 0
        });

        setTotalSummary(totals);

      } catch (error) {
        console.error('Error fetching GST report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGSTReport();
  }, [db, userId, appId, dateRange, selectedParty, parties, gstType]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN');
  };

  // Handle row click - open document
  const handleRowClick = (record) => {
    setBillModal({ id: record.docId, type: record.recordType === 'outward' ? 'outward' : 'inward' });
  };

  // Filter data based on report type, party, and invoice type
  const getFilteredData = () => {
    let filtered = [...sortedData];
    
    // Report kind + view selector
    if (reportType === 'gstr1') {
      if (viewMode === 'sales') {
      filtered = filtered.filter(record => record.recordType === 'outward');
      } else if (viewMode === 'purchases') {
        filtered = filtered.filter(record => record.recordType === 'inward');
      } // both = no filter
    }

    // Party filter
    if (selectedParty) {
      filtered = filtered.filter(r => r.partyId === selectedParty);
    }

    // Invoice type (B2B/B2C)
    if (invoiceType !== 'all') {
      filtered = filtered.filter(record => record.invoiceType === invoiceType);
    }
    
    return filtered;
  };

  // Data to display
  const displayData = getFilteredData();

  // Quick totals should reflect filters and view
  const quickTotals = useMemo(() => {
    // Determine the dataset based on report type and View selector
    let base = [];
    if (reportType === 'gstr1') {
      base = [...filteredForTable];
    } else {
      // Start from all records then filter by party/invoiceType/view
      base = [...sortedData];
      if (selectedParty) base = base.filter(r => r.partyId === selectedParty);
      if (invoiceType !== 'all') base = base.filter(r => r.invoiceType === invoiceType);
      if (viewMode === 'sales') base = base.filter(r => r.recordType === 'outward');
      else if (viewMode === 'purchases') base = base.filter(r => r.recordType === 'inward');
    }
    const invoices = base.length;
    const taxable = base.reduce((s, r) => s + (parseFloat(r.taxable) || 0), 0);
    const totalGST = base.reduce((s, r) => s + (parseFloat(r.totalGST) || 0), 0);
    const totalAmount = base.reduce((s, r) => s + (parseFloat(gstType === 'regular' ? r.total : r.taxable) || 0), 0);
    return { invoices, taxable, totalGST, totalAmount };
  }, [reportType, filteredForTable, sortedData, selectedParty, invoiceType, viewMode, gstType]);

  // GSTR-3B Summary calculation
  const getGSTR3BSummary = () => {
    const outward = displayData.filter(record => record.recordType === 'outward');
    const inward = displayData.filter(record => record.recordType === 'inward');
    const outwardForView = viewMode === 'purchases' ? [] : outward;
    const inwardForView = viewMode === 'sales' ? [] : inward;

    const outwardSummary = outwardForView.reduce((acc, record) => {
      const totalGST = gstType === 'composition'
        ? (Array.isArray(record.children) ? record.children.reduce((s, c) => s + ((c.taxable || 0) * (c.rate || 0) / 100), 0) : 0)
        : (record.cgst + record.sgst + record.igst);
      const cg = gstType === 'composition' ? totalGST / 2 : record.cgst;
      const sg = gstType === 'composition' ? totalGST / 2 : record.sgst;
      const ig = gstType === 'composition' ? 0 : record.igst;
      acc.taxable += record.taxable; acc.cgst += cg; acc.sgst += sg; acc.igst += ig;
      return acc;
    }, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    const inwardSummary = inwardForView.reduce((acc, record) => {
      const totalGST = gstType === 'composition'
        ? (Array.isArray(record.children) ? record.children.reduce((s, c) => s + ((c.taxable || 0) * (c.rate || 0) / 100), 0) : 0)
        : (record.cgst + record.sgst + record.igst);
      const cg = gstType === 'composition' ? totalGST / 2 : record.cgst;
      const sg = gstType === 'composition' ? totalGST / 2 : record.sgst;
      const ig = gstType === 'composition' ? 0 : record.igst;
      acc.taxable += record.taxable; acc.cgst += cg; acc.sgst += sg; acc.igst += ig;
      return acc;
    }, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });

    // For composition, build rate-wise breakdowns (outward/inward)
    const computeRateBreakdown = (records, isCompositionMode) => {
      const map = new Map(); // rate -> {taxable, tax}
      for (const rec of records) {
        if (Array.isArray(rec.children) && rec.children.length > 0) {
          for (const c of rec.children) {
            const rate = Number(c.rate || 0);
            const taxable = Number(c.taxable || 0);
            const tax = isCompositionMode
              ? (taxable * rate) / 100
              : (Number(c.cgst || 0) + Number(c.sgst || 0) + Number(c.igst || 0));
            if (!map.has(rate)) map.set(rate, { rate, taxable: 0, tax: 0 });
            const g = map.get(rate);
            g.taxable += taxable; g.tax += tax;
            // also carry individual components for convenience
            g.cgst = (g.cgst || 0) + (isCompositionMode ? tax / 2 : Number(c.cgst || 0));
            g.sgst = (g.sgst || 0) + (isCompositionMode ? tax / 2 : Number(c.sgst || 0));
            g.igst = (g.igst || 0) + (isCompositionMode ? 0 : Number(c.igst || 0));
          }
        } else if (rec.gstPercent != null) {
          const rate = Number(rec.gstPercent || 0);
          const taxable = Number(rec.taxable || 0);
          const tax = isCompositionMode ? (taxable * rate) / 100 : Number(rec.totalGST || 0);
          if (!map.has(rate)) map.set(rate, { rate, taxable: 0, tax: 0 });
          const g = map.get(rate);
          g.taxable += taxable; g.tax += tax;
          g.cgst = (g.cgst || 0) + (isCompositionMode ? tax / 2 : Number(rec.cgst || 0));
          g.sgst = (g.sgst || 0) + (isCompositionMode ? tax / 2 : Number(rec.sgst || 0));
          g.igst = (g.igst || 0) + (isCompositionMode ? 0 : Number(rec.igst || 0));
        }
      }
      return Array.from(map.values()).sort((a,b) => a.rate - b.rate);
    };

    const rateBreakdown = {
      outward: computeRateBreakdown(outwardForView, gstType === 'composition'),
      inward: computeRateBreakdown(inwardForView, gstType === 'composition')
    };

    // Composition net payable must equal sum of rate-wise outward taxes
    const compositionTax = gstType === 'composition' ? (rateBreakdown?.outward || []).reduce((s, r) => s + (r.tax || 0), 0) : 0;

    return {
      outward: outwardSummary,
      inward: inwardSummary,
      netPayable: {
        cgst: gstType === 'regular' ? outwardSummary.cgst - inwardSummary.cgst : 0,
        sgst: gstType === 'regular' ? outwardSummary.sgst - inwardSummary.sgst : 0,
        igst: gstType === 'regular' ? outwardSummary.igst - inwardSummary.igst : 0,
        composition: compositionTax
      },
      rateBreakdown
    };
  };

  const gstr3bSummary = getGSTR3BSummary();

  // Persist GSTR-3B summary for other modules (e.g., Profit & Loss) to trace directly without recalculation
  useEffect(() => {
    try {
      const startStr = new Date(dateRange.start).toISOString().split('T')[0];
      const endStr = new Date(dateRange.end).toISOString().split('T')[0];
      const cacheKey = `gstr3b:${appId}:${userId}:${startStr}:${endStr}:${gstType}`;
      const payload = {
        summary: gstr3bSummary,
        gstType,
        viewMode,
        invoiceType,
        period: { start: startStr, end: endStr },
        savedAt: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(payload));
      // Notify same-tab listeners
      try { window.dispatchEvent(new CustomEvent('gstr3b-updated', { detail: { key: cacheKey } })); } catch {}
    } catch {}
  }, [gstr3bSummary, gstType, viewMode, invoiceType, dateRange, appId, userId]);

  return (
    <div className="p-6">
      {/* Report Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">GST Summary Report</h2>
        <p className="text-gray-600">
          Period: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
          {selectedParty && ` | Party: ${parties.find(p => p.id === selectedParty)?.partyName || selectedParty}`}
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={exportPDF} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm">📄 Export PDF</button>
          <button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm">📊 Export Excel</button>
          <button onClick={printReport} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm">🖨️ Print</button>
          <ShareButton onExportPDF={exportPDF} onExportExcel={exportExcel} onExportImage={exportImage} onShareLink={() => shareLink({ title: 'GST Report', text: 'GST report link', url: window.location.href })} />
        </div>
      </div>

      {/* Filters (without internal Report Type to avoid duplication with Taxes dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {!forcedGstType && (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">GST Type</label>
          <select
              value={gstType}
              onChange={(e) => setGstType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
              <option value="regular">Regular</option>
              <option value="composition">Composition</option>
          </select>
        </div>
        )}
        {gstType === 'composition' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Composition Rate (%)</label>
            <input type="number" min="0" step="0.1" value={compositionRate}
              onChange={(e) => setCompositionRate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Type</label>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="export">Export</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="both">Sales + Purchases</option>
            <option value="sales">Only Sales</option>
            <option value="purchases">Only Purchases</option>
          </select>
        </div>
        {/* Removed Period sort from GST Summary filters */}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Invoices</div>
          <div className="text-2xl font-bold text-blue-800">{quickTotals.invoices}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Total Taxable</div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(quickTotals.taxable)}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Total GST</div>
          <div className="text-2xl font-bold text-purple-800">{formatCurrency(quickTotals.totalGST)}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-sm text-yellow-600 font-medium">Total Amount</div>
          <div className="text-2xl font-bold text-yellow-800">{formatCurrency(quickTotals.totalAmount)}</div>
        </div>
      </div>

      {/* GSTR-3B Summary View */}
      {reportType === 'gstr3b' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{gstType === 'regular' ? 'GSTR-3B Summary' : 'Composition Summary'}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable</th>
                  {gstType === 'regular' ? (
                    <>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CGST</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SGST</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IGST</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Tax</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CGST</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SGST</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Composition Tax</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {viewMode !== 'purchases' && (
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Outward</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.taxable)}</td>
                  {gstType === 'regular' ? (
                    <>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.cgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.sgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.igst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.outward.cgst + gstr3bSummary.outward.sgst + gstr3bSummary.outward.igst)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.composition/2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.composition/2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.composition)}</td>
                    </>
                  )}
                </tr>
                )}
                {viewMode !== 'purchases' && Array.isArray(gstr3bSummary.rateBreakdown?.outward) && gstr3bSummary.rateBreakdown.outward.map((r, idx) => (
                  <tr key={`rb-inline-out-${idx}`} className="bg-gray-50">
                    <td className="px-6 py-2 text-xs text-gray-700 pl-10">{(r.rate || 0).toFixed(2)}%</td>
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(r.taxable)}</td>
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(gstType==='composition' ? r.tax/2 : r.cgst)}</td>
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(gstType==='composition' ? r.tax/2 : r.sgst)}</td>
                    {gstType === 'regular' && (
                      <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(r.igst)}</td>
                    )}
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(gstType==='composition' ? r.tax : (r.cgst + r.sgst + r.igst))}</td>
                </tr>
                ))}
                {viewMode !== 'sales' && (
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Inward ITC</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.taxable)}</td>
                  {gstType === 'regular' ? (
                    <>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.cgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.sgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.igst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(gstr3bSummary.inward.cgst + gstr3bSummary.inward.sgst + gstr3bSummary.inward.igst)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                    </>
                  )}
                </tr>
                )}
                {viewMode !== 'sales' && Array.isArray(gstr3bSummary.rateBreakdown?.inward) && gstr3bSummary.rateBreakdown.inward.map((r, idx) => (
                  <tr key={`rb-inline-in-${idx}`} className="bg-gray-50">
                    <td className="px-6 py-2 text-xs text-gray-700 pl-10">{(r.rate || 0).toFixed(2)}%</td>
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(r.taxable)}</td>
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(gstType==='composition' ? r.tax/2 : r.cgst)}</td>
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(gstType==='composition' ? r.tax/2 : r.sgst)}</td>
                    {gstType === 'regular' && (
                      <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(r.igst)}</td>
                    )}
                    <td className="px-6 py-2 text-xs text-right text-gray-700">{formatCurrency(gstType==='composition' ? r.tax : (r.cgst + r.sgst + r.igst))}</td>
                </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">Net Payable</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">-</td>
                  {gstType === 'regular' ? (
                    <>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.cgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.sgst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.igst)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.cgst + gstr3bSummary.netPayable.sgst + gstr3bSummary.netPayable.igst)}</td>
                    </>
                  ) : (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">{formatCurrency(gstr3bSummary.netPayable.composition)}</td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GST Records Table */}
      {reportType === 'gstr1' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Top horizontal scroller */}
          <div className="overflow-x-auto" ref={topScrollRef}>
            <div style={{ width: tableWidth || '100%' }}>&nbsp;</div>
          </div>
          {/* Main table with bottom scroller */}
          <div className="overflow-x-auto" ref={bottomScrollRef}>
            <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader 
                    columnKey="date" 
                    label="Date" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="docNo" 
                    label="Invoice No" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="partyName" 
                    label="Party" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="supplyState" 
                    label="Supply State" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="invoiceType" 
                    label="Type" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="gstPercent" 
                    label="GST %" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="totalGST" 
                    label="GST Amount" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="taxable" 
                    label="Taxable" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="cgst" 
                    label="CGST" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  <SortableHeader 
                    columnKey="sgst" 
                    label="SGST" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  {gstType === 'regular' && (
                  <SortableHeader 
                    columnKey="igst" 
                    label="IGST" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                  )}
                  <SortableHeader 
                    columnKey="total" 
                    label="Total" 
                    onSort={handleSort} 
                    sortConfig={sortConfig} 
                  />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagination.currentData.map((record, index) => (
                  <React.Fragment key={record.docId || index}>
                  <tr 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(record)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600 hover:underline">
                        {record.docNo}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.partyName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.supplyState}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        record.invoiceType === 'B2B' ? 'bg-blue-100 text-blue-800' :
                        record.invoiceType === 'B2C' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                      {gstType === 'composition' ? 'BOS' : record.invoiceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{record.gstPercent != null ? `${(record.gstPercent || 0).toFixed(2)}%` : '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(record.totalGST)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.taxable)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(gstType === 'composition' ? record.cgst : record.cgst)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(gstType === 'composition' ? record.sgst : record.sgst)}
                    </td>
                    {gstType === 'regular' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(record.igst)}
                    </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(gstType === 'composition' ? record.taxable : record.total)}
                    </td>
                  </tr>
                  {Array.isArray(record.children) && record.children.length > 1 ? record.children.map((c, i) => (
                    <tr key={(record.docId || index) + '-child-' + i} className="bg-gray-50">
                      {/* For composition, first 'GST %' column shows the percentage but has no header value requirement change */}
                      {/* Align under columns: Date, Invoice, Party, State, Type */}
                      <td className="px-6 py-2 text-xs text-gray-500" colSpan={5}></td>
                      {/* GST % */}
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{(c.rate || 0).toFixed(2)}%</td>
                      {/* GST Amount number for composition: taxable * rate% */}
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(gstType === 'composition' ? ((c.taxable || 0) * (c.rate || 0) / 100) : c.totalGST)}</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(c.taxable)}</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(gstType === 'composition' ? ((c.taxable || 0) * (c.rate || 0) / 200) : c.cgst)}</td>
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(gstType === 'composition' ? ((c.taxable || 0) * (c.rate || 0) / 200) : c.sgst)}</td>
                      {gstType === 'regular' && (
                        <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(c.igst)}</td>
                      )}
                      <td className="px-6 py-2 text-xs text-right text-gray-600">{formatCurrency(gstType === 'composition' ? (c.taxable) : (c.taxable + c.totalGST))}</td>
                    </tr>
                  )) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <PaginationControls {...pagination} />
        </div>
      )}

      {billModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl" onClick={() => { setBillModal(null); setBillDetails(null); }}>&times;</button>
            <h3 className="text-lg font-bold mb-4">{billModal.type === 'outward' ? 'Sales' : 'Purchase'} Invoice Summary</h3>
            {!billDetails ? (
              <div className="text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Number:</span> {billDetails.number || billDetails.invoiceNumber || billDetails.billNumber}</div>
                <div><span className="font-medium">Date:</span> {billDetails.invoiceDate || billDetails.billDate}</div>
                <div><span className="font-medium">Amount:</span> {formatCurrency(billDetails.amount || 0)}</div>
                <div className="mt-2">
                  <div className="font-semibold">Items:</div>
                  <ul className="list-disc ml-6">
                    {(billDetails._enrichedRows || billDetails.rows || billDetails.items || []).map((r, i) => {
                      const name = r._displayName || r.description || (itemMap[r.item]?.name) || r.item || 'Item';
                      return (
                        <li key={i}>{name} — Qty: {r.qty || r.nos || '-'} Rate: {formatCurrency(r.rate || 0)} Amount: {formatCurrency(r.amount || 0)}</li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Data Message */}
      {displayData.length === 0 && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-500 text-lg mb-2">No GST data found</div>
          <p className="text-gray-400">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
};

export default GSTSummaryReport; 
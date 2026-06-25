import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import TransactionList from '../components/transactions/TransactionList';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocation } from 'react-router-dom';
import { IndiaPriceMap } from '../components/IndiaPriceMap';
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  FileText,
  Plus,
  Trash2,
  IndianRupee,
  Download,
  Clock,
  ChevronRight,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  Edit3,
  RefreshCw,
  AlertTriangle,
  Activity,
  Camera,
  Image,
  X,
  Calculator,
} from 'lucide-react';

type PendingCollateralImage = {
  file: File;
  name: string;
  preview: string;
};

const CUSTOMS_DUTY_RATE = 0.15;
const GST_RATE = 0.03;

export const Dashboard: React.FC = () => {
  const { hasPermission, theme } = useApp();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);

  // Global system stats
  const [globalStats, setGlobalStats] = useState({
    activeLoansCount: 0,
    outstandingPrincipal: 0,
    outstandingInterest: 0,
    pendingLoansCount: 0,
  });

  // Modal triggers
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showQuickCalc, setShowQuickCalc] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState<any | null>(null);
  const [loanSchedule, setLoanSchedule] = useState<any[]>([]);
  const [loanTimeline, setLoanTimeline] = useState<any[]>([]);

  // Collateral images state
  const [collateralImages, setCollateralImages] = useState<any[]>([]);
  const [collateralImagePreview, setCollateralImagePreview] = useState<string | null>(null);
  const collateralFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCollateralImages, setPendingCollateralImages] = useState<PendingCollateralImage[]>([]);
  const newLoanCollateralInputRef = useRef<HTMLInputElement>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  // Edit loan form state
  const [editLoanForm, setEditLoanForm] = useState({
    loanTypeId: '',
    amount: '',
    interestTypeId: '',
    interestRate: '',
    tenureMonths: '',
    startDate: '',
  });

  // Form states
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    dob: '',
    occupation: '',
    kycNumber: '',
    kycType: 'Aadhaar',
  });

  const [masters, setMasters] = useState<any>({
    loanTypes: [],
    interestTypes: [],
    paymentTypes: [],
  });

  const [newLoanForm, setNewLoanForm] = useState({
    loanTypeId: '',
    amount: '',
    interestTypeId: '',
    interestRate: '',
    tenureMonths: '',
    startDate: new Date().toISOString().split('T')[0],
    collateralType: 'GOLD',
    collateralWeight: '',
    collateralPurity: '',
    purityUnit: 'PERCENTAGE', // KARAT, PERCENTAGE
    collateralValue: '',
    collateralDescription: '',
  });

  const [noteForm, setNoteForm] = useState({ title: '', content: '' });

  const [paymentForm, setPaymentForm] = useState({
    loanId: null as number | null,
    paymentTypeCode: 'EMI',
    amount: '',
    referenceNumber: '',
    notes: '',
    principalReductionOption: 'REDUCE_EMI' as 'REDUCE_EMI' | 'REDUCE_TENURE',
  });

  // Files state
  const [uploadDoc, setUploadDoc] = useState({
    name: '',
    documentType: 'Aadhaar',
    fileData: '',
    fileType: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhancement state
  const [marketRates, setMarketRates] = useState<any[]>([]);
  const [marketWatchAsset, setMarketWatchAsset] = useState<string>('GOLD');
  const [showMapView, setShowMapView] = useState(false);
  const [editingAssetRate, setEditingAssetRate] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');
  const [activeTab, setActiveTab] = useState<'loans' | 'payments' | 'transactions' | 'documents' | 'notes' | 'timeline' | 'risk'>('loans');
  const [marketHistory, setMarketHistory] = useState<{ date: string, rate: number, apiRate?: number }[]>([]);

  // Quick Calculator state
  const [quickCalc, setQuickCalc] = useState({
    asset: 'GOLD',
    weight: '',
    purity: '',
    purityUnit: 'PERCENTAGE',
    interestRate: '12',
    tenure: '12',
    interestType: 'SIMPLE',
  });

  // Initial Fetch
  useEffect(() => {
    fetchCustomers();
    fetchMasters();
    fetchGlobalStats();
    fetchMarketRates();
  }, []);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.customerId) {
      setSelectedCustomerId(location.state.customerId);
      // Clear state so back-navigation doesn't re-select
      window.history.replaceState({}, '');
    }
  }, []);

  // Fetch workspace details if customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerWorkspace(selectedCustomerId);
    } else {
      setWorkspace(null);
      setSelectedLoanForDetails(null);
    }
  }, [selectedCustomerId]);

  // Fetch loan subdata if selected loan changes
  useEffect(() => {
    if (selectedLoanForDetails) {
      fetchLoanDetails(selectedLoanForDetails.id);
    } else {
      setLoanSchedule([]);
      setLoanTimeline([]);
    }
  }, [selectedLoanForDetails]);

  // Replace the fake marketChartData useMemo with a useEffect that calls your real API:
  useEffect(() => {
    if (!marketWatchAsset) return;
    api.get(`/market-rates/history/${marketWatchAsset}`)
      .then(res => {
        const data = res.data.map((entry: any) => {
          const rawDate = entry.recordedAt;
          const dateObj = typeof rawDate === 'number'
            ? new Date(rawDate * 1000)   // Unix seconds → milliseconds
            : new Date(rawDate);          // ISO string → direct parse

          return {
            date: dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            rate: getEstimatedRetailRate(marketWatchAsset, Number(entry.rate)),
            apiRate: Number(entry.rate),
          };
        });
        setMarketHistory(data);
      })
      .catch(() => setMarketHistory([]));
  }, [marketWatchAsset]);

  const fetchMarketRates = async () => {
    try {
      const res = await api.get('/market-rates');
      setMarketRates(res.data);
    } catch (err) {
      console.error('Error fetching market rates:', err);
    }
  };

  const handleUpdateManualRate = async (asset: string, rate: number) => {
    try {
      await api.post('/market-rates/manual', { asset, rate });
      setEditingAssetRate(null);
      fetchMarketRates();
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update rate manually.');
    }
  };

  const handleTriggerSync = async (asset?: string) => {
    try {
      await api.post('/market-rates/sync', asset ? { asset } : {});
      fetchMarketRates();
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to trigger sync.');
    }
  };

  const handleRecalculateRisk = async () => {
    if (!selectedCustomerId) return;
    try {
      const res = await api.post(`/customers/risk/recalculate/${selectedCustomerId}`);
      alert(res.data.message);
      fetchCustomerWorkspace(selectedCustomerId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to recalculate risk.');
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const res = await api.get('/reports/loans?scope=dashboard');
      setGlobalStats({
        activeLoansCount: res.data.stats.activeCount,
        outstandingPrincipal: res.data.stats.totalOutstandingPrincipal,
        outstandingInterest: res.data.stats.totalOutstandingInterest,
        pendingLoansCount: res.data.stats.pendingCount,
        ...res.data.stats,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const fetchCustomers = async (query = '') => {
    try {
      const res = await api.get(`/customers/search?query=${encodeURIComponent(query)}`);
      setCustomersList(res.data);
    } catch (err) {
      console.error('Error searching customers:', err);
    }
  };

  const fetchMasters = async () => {
    try {
      const res = await api.get('/settings/masters');
      setMasters({
        loanTypes: res.data.loanTypes,
        interestTypes: res.data.interestTypes,
        paymentTypes: res.data.paymentTypes,
      });
      // Prepopulate dropdown selections
      if (res.data.loanTypes[0]) {
        setNewLoanForm((prev) => ({ ...prev, loanTypeId: String(res.data.loanTypes[0].id) }));
      }
      if (res.data.interestTypes[0]) {
        setNewLoanForm((prev) => ({ ...prev, interestTypeId: String(res.data.interestTypes[0].id) }));
      }
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchCustomerWorkspace = async (id: number) => {
    try {
      const res = await api.get(`/customers/workspace/${id}`);
      setWorkspace(res.data);

      if (!selectedLoanForDetails) {
        if (res.data.activeLoans[0]) {
          setSelectedLoanForDetails(res.data.activeLoans[0]);
        } else if (res.data.pastLoans[0]) {
          setSelectedLoanForDetails(res.data.pastLoans[0]);
        }
      } else {
        const updatedLoan =
          res.data.activeLoans.find((l: any) => l.id === selectedLoanForDetails.id) ||
          res.data.pastLoans.find((l: any) => l.id === selectedLoanForDetails.id);
        if (updatedLoan) {
          setSelectedLoanForDetails(updatedLoan);
        }
      }
    } catch (err) {
      console.error('Error loading customer workspace:', err);
    }
  };

  const fetchLoanDetails = async (loanId: number) => {
    try {
      const schedRes = await api.get(`/loans/schedule/${loanId}`);
      const timeRes = await api.get(`/loans/timeline/${loanId}`);
      setLoanSchedule(schedRes.data);
      setLoanTimeline(timeRes.data);
    } catch (err) {
      console.error('Error loading loan subdetails:', err);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchCustomers(val);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        name: newCustomerForm.name,
        mobile: newCustomerForm.mobile,
        email: newCustomerForm.email || null,
        address: newCustomerForm.address || null,
        dob: newCustomerForm.dob || null,
        occupation: newCustomerForm.occupation || null,
        kycNumber: newCustomerForm.kycNumber || null,
        kycInfo: { type: newCustomerForm.kycType },
      };

      const res = await api.post('/customers/create', body);
      setShowAddCustomer(false);
      setNewCustomerForm({ name: '', mobile: '', email: '', address: '', dob: '', occupation: '', kycNumber: '', kycType: 'Aadhaar' });
      setSelectedCustomerId(res.data.id);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create customer.');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!workspace) return;
    if (!window.confirm(`Are you sure you want to soft-delete customer ${workspace.personalDetails.name}?`)) return;

    try {
      await api.delete(`/customers/delete/${workspace.personalDetails.id}`);
      setSelectedCustomerId(null);
      fetchCustomers();
      fetchGlobalStats();
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.requiresTransfer) {
        const choice = window.prompt(
          `${err.response.data.message}\n\nEnter an existing customer ID to transfer ongoing loans, or type NEW to create a new customer first.`
        );

        if (!choice) return;

        const transferPayload: any = {};
        if (choice.trim().toUpperCase() === 'NEW') {
          const name = window.prompt('Enter new customer name for the ongoing loans:');
          const mobile = window.prompt('Enter new customer mobile number:');
          if (!name || !mobile) return;
          transferPayload.createTransferCustomer = { name, mobile };
        } else {
          const transferToCustomerId = Number(choice);
          if (!Number.isInteger(transferToCustomerId) || transferToCustomerId <= 0) {
            alert('Please enter a valid customer ID.');
            return;
          }
          transferPayload.transferToCustomerId = transferToCustomerId;
        }

        try {
          await api.delete(`/customers/delete/${workspace.personalDetails.id}`, { data: transferPayload });
          setSelectedCustomerId(null);
          fetchCustomers();
          fetchGlobalStats();
          alert('Customer deleted and ongoing loans transferred successfully.');
        } catch (transferErr: any) {
          alert(transferErr.response?.data?.message || 'Error transferring loans before deleting customer.');
        }
        return;
      }

      alert(err.response?.data?.message || 'Error deleting customer.');
    }
  };

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unable to read image file.'));
          return;
        }
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error || new Error('Unable to read image file.'));
      reader.readAsDataURL(file);
    });

  const handleNewLoanCollateralImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const images = files.map((file) => ({
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
    }));

    setPendingCollateralImages((prev) => [...prev, ...images]);
    e.target.value = '';
  };

  const handleRemovePendingCollateralImage = (index: number) => {
    setPendingCollateralImages((prev) => {
      const image = prev[index];
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const openCollateralCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera capture is not available in this browser.');
      setShowCameraModal(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraStream(stream);
      setShowCameraModal(true);
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => undefined);
        }
      }, 0);
    } catch {
      setCameraError('Unable to open camera. Please allow camera permission or use Upload Photo.');
      setShowCameraModal(true);
    }
  };

  const closeCollateralCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setShowCameraModal(false);
    setCameraError('');
  };

  const captureCollateralPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera preview is not ready yet.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Unable to capture photo from camera.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Unable to capture photo from camera.');
        return;
      }
      const file = new File([blob], `collateral-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPendingCollateralImages((prev) => [
        ...prev,
        {
          file,
          name: file.name,
          preview: URL.createObjectURL(file),
        },
      ]);
      closeCollateralCamera();
    }, 'image/jpeg', 0.92);
  };

  const clearPendingCollateralImages = () => {
    setPendingCollateralImages((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.preview));
      return [];
    });
  };

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    try {
      const body = {
        customerId: selectedCustomerId,
        loanTypeId: parseInt(newLoanForm.loanTypeId),
        amount: parseFloat(newLoanForm.amount),
        interestTypeId: parseInt(newLoanForm.interestTypeId),
        interestRate: parseFloat(newLoanForm.interestRate),
        tenureMonths: parseInt(newLoanForm.tenureMonths),
        startDate: newLoanForm.startDate,
        collateralType: newLoanForm.collateralType,
        collateralWeight: newLoanForm.collateralWeight ? parseFloat(newLoanForm.collateralWeight) : null,
        collateralPurity: newLoanForm.collateralPurity ? parseFloat(newLoanForm.collateralPurity) : null,
        purityUnit: newLoanForm.purityUnit,
        collateralValue: newLoanForm.collateralValue ? parseFloat(newLoanForm.collateralValue) : null,
        collateralDescription: newLoanForm.collateralDescription || null,
      };

      const res = await api.post('/loans/create', body);
      const collateralId = res.data?.loan?.collateral?.id;

      if (collateralId && pendingCollateralImages.length > 0) {
        await Promise.all(
          pendingCollateralImages.map(async (image) => {
            const fileData = await readFileAsBase64(image.file);
            await api.post(`/collateral/${collateralId}/images`, {
              fileName: image.name,
              fileData,
              fileType: image.file.type,
            });
          })
        );
      }

      clearPendingCollateralImages();
      setShowAddLoan(false);
      fetchCustomerWorkspace(selectedCustomerId);
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create loan application.');
    }
  };

  const handleApproveLoan = async (loanId: number) => {
    try {
      await api.post(`/loans/approve/${loanId}`);
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Approval failed.');
    }
  };

  const handleRejectLoan = async (loanId: number) => {
    try {
      await api.post(`/loans/reject/${loanId}`);
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Rejection failed.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    try {
      await api.post(`/customers/note/${selectedCustomerId}`, noteForm);
      setShowAddNote(false);
      setNoteForm({ title: '', content: '' });
      fetchCustomerWorkspace(selectedCustomerId);
    } catch {
      alert('Error creating note.');
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm('Delete note?')) return;
    try {
      await api.delete(`/customers/note/${noteId}`);
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
    } catch {
      alert('Error deleting note.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        await api.post(`/customers/document/${selectedCustomerId}`, {
          name: file.name,
          documentType: uploadDoc.documentType,
          fileData: base64Data,
          fileType: file.type,
        });
        if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
      } catch {
        alert('File upload failed.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm('Soft-delete this document?')) return;
    try {
      await api.delete(`/customers/document/${docId}`);
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
    } catch {
      alert('Error deleting document.');
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.loanId) return;

    try {
      await api.post('/payments/process', {
        loanId: paymentForm.loanId,
        paymentTypeCode: paymentForm.paymentTypeCode,
        amount: parseFloat(paymentForm.amount),
        referenceNumber: paymentForm.referenceNumber || null,
        notes: paymentForm.notes || null,
        principalReductionOption: paymentForm.paymentTypeCode === 'PRINCIPAL_ONLY' ? paymentForm.principalReductionOption : null,
      });

      setShowPaymentModal(false);
      setPaymentForm((prev) => ({ ...prev, amount: '', referenceNumber: '', notes: '' }));
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error processing transaction.');
    }
  };

  const selectedMarketRate = marketRates.find(mr => mr.asset === marketWatchAsset) || marketRates[0];
  const isRetailMetal = (asset?: string) => ['GOLD', 'SILVER'].includes(String(asset || '').toUpperCase());
  const getEstimatedRetailRate = (asset: string, apiRate: number) => {
    if (!isRetailMetal(asset)) return apiRate;
    return Math.round(apiRate * (1 + CUSTOMS_DUTY_RATE) * (1 + GST_RATE) * 100) / 100;
  };
  const selectedRetailRate = selectedMarketRate
    ? getEstimatedRetailRate(selectedMarketRate.asset, selectedMarketRate.rate)
    : 0;

  // ── Loan Edit / Delete / Restore handlers ─────────────────────

  const handleOpenEditLoan = (loan: any) => {
    setEditLoanForm({
      loanTypeId: String(loan.loanTypeId),
      amount: String(loan.amount),
      interestTypeId: String(loan.interestTypeId),
      interestRate: String(loan.interestRate),
      tenureMonths: String(loan.tenureMonths),
      startDate: new Date(loan.startDate).toISOString().split('T')[0],
    });
    setShowEditLoanModal(true);
  };

  const handleUpdateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForDetails) return;
    try {
      await api.put(`/loans/${selectedLoanForDetails.id}`, {
        loanTypeId: parseInt(editLoanForm.loanTypeId),
        amount: parseFloat(editLoanForm.amount),
        interestTypeId: parseInt(editLoanForm.interestTypeId),
        interestRate: parseFloat(editLoanForm.interestRate),
        tenureMonths: parseInt(editLoanForm.tenureMonths),
        startDate: editLoanForm.startDate,
      });
      setShowEditLoanModal(false);
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update loan.');
    }
  };

  const handleSoftDeleteLoan = async (loanId: number) => {
    if (!window.confirm('Are you sure you want to soft-delete this loan? It can be restored by an Admin.')) return;
    try {
      await api.delete(`/loans/${loanId}`);
      setSelectedLoanForDetails(null);
      if (selectedCustomerId) fetchCustomerWorkspace(selectedCustomerId);
      fetchGlobalStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete loan.');
    }
  };

  // ── Collateral Image handlers ─────────────────────────────────

  const fetchCollateralImages = async (loanId: number) => {
    try {
      const res = await api.get(`/collateral/by-loan/${loanId}`);
      setCollateralImages(res.data.images || []);
    } catch {
      setCollateralImages([]);
    }
  };

  // Re-fetch collateral images when selected loan changes
  useEffect(() => {
    if (selectedLoanForDetails?.id) {
      fetchCollateralImages(selectedLoanForDetails.id);
    } else {
      setCollateralImages([]);
    }
  }, [selectedLoanForDetails?.id]);

  const handleCollateralImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLoanForDetails?.collateral) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        await api.post(`/collateral/${selectedLoanForDetails.collateral.id}/images`, {
          fileName: file.name,
          fileData: base64Data,
          fileType: file.type,
        });
        fetchCollateralImages(selectedLoanForDetails.id);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Image upload failed.');
      }
    };
    reader.readAsDataURL(file);
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const handleDeleteCollateralImage = async (imageId: number) => {
    if (!window.confirm('Delete this collateral image?')) return;
    try {
      await api.delete(`/collateral/images/${imageId}`);
      if (selectedLoanForDetails?.id) fetchCollateralImages(selectedLoanForDetails.id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete image.');
    }
  };

  // ── Market Demo History handler ───────────────────────────────

  const handleGenerateDemoHistory = async () => {
    if (!window.confirm(`Generate 60 days of realistic demo history for ${marketWatchAsset}?`)) return;
    try {
      const res = await api.post('/market-rates/generate-history', { asset: marketWatchAsset, days: 60 });
      alert(res.data.message);
      // Refresh the chart
      const histRes = await api.get(`/market-rates/history/${marketWatchAsset}`);
      const data = histRes.data.map((entry: any) => ({
        date: new Date(entry.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rate: Number(entry.rate),
      }));
      setMarketHistory(data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate history.');
    }
  };

  // Helper to calculate previews for the Add Loan form
  const getLoanFormPreview = () => {
    const principal = parseFloat(newLoanForm.amount) || 0;
    const rate = parseFloat(newLoanForm.interestRate) || 0;
    const tenure = parseInt(newLoanForm.tenureMonths) || 0;

    const selectedInterestType = masters.interestTypes.find((t: any) => String(t.id) === String(newLoanForm.interestTypeId));
    const interestTypeCode = selectedInterestType?.code || 'COMPOUND';

    if (principal <= 0 || rate <= 0 || tenure <= 0) {
      return null;
    }

    let emi = 0;
    let totalInterest = 0;

    if (interestTypeCode === 'COMPOUND') {
      const r = rate / 100 / 12;
      if (r === 0) {
        emi = principal / tenure;
      } else {
        emi = (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
      }
      emi = Math.round(emi * 100) / 100;
      totalInterest = Math.round((emi * tenure - principal) * 100) / 100;
    } else {
      totalInterest = Math.round(principal * (rate / 100) * (tenure / 12) * 100) / 100;
      emi = Math.round(((principal + totalInterest) / tenure) * 100) / 100;
    }

    return {
      emi,
      totalInterest,
      totalPayable: principal + totalInterest,
    };
  };

  const getCollateralAppraisalPreview = () => {
    const asset = newLoanForm.collateralType;
    const weight = parseFloat(newLoanForm.collateralWeight) || 0;
    const purity = parseFloat(newLoanForm.collateralPurity) || 0;
    const unit = newLoanForm.purityUnit;

    if (weight <= 0 || purity <= 0 || (asset !== 'GOLD' && asset !== 'SILVER')) {
      return null;
    }

    const marketRateObj = marketRates.find(mr => mr.asset === asset);
    const rate = marketRateObj ? marketRateObj.rate : 0;
    const purityRatio = unit === 'KARAT' ? purity / 24 : purity / 100;
    const appraised = weight * rate * purityRatio;

    return appraised;
  };

  const getEditLoanFormPreview = () => {
    const principal = parseFloat(editLoanForm.amount) || 0;
    const rate = parseFloat(editLoanForm.interestRate) || 0;
    const tenure = parseInt(editLoanForm.tenureMonths) || 0;

    const selectedInterestType = masters.interestTypes.find((t: any) => String(t.id) === String(editLoanForm.interestTypeId));
    const interestTypeCode = selectedInterestType?.code || 'COMPOUND';

    if (principal <= 0 || rate <= 0 || tenure <= 0) {
      return null;
    }

    let emi = 0;
    let totalInterest = 0;

    if (interestTypeCode === 'COMPOUND') {
      const r = rate / 100 / 12;
      if (r === 0) {
        emi = principal / tenure;
      } else {
        emi = (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
      }
      emi = Math.round(emi * 100) / 100;
      totalInterest = Math.round((emi * tenure - principal) * 100) / 100;
    } else {
      totalInterest = Math.round(principal * (rate / 100) * (tenure / 12) * 100) / 100;
      emi = Math.round(((principal + totalInterest) / tenure) * 100) / 100;
    }

    return {
      emi,
      totalInterest,
      totalPayable: principal + totalInterest,
    };
  };

  return (
    <div className="space-y-6">

      {/* Search Header Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div id="tour-search" className="relative w-full max-w-lg">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search Customers by ID, Name, or Mobile..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold shadow-sm transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowQuickCalc(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border hover:border-brand-gold text-brand-navy dark:text-white font-bold rounded-xl shadow-sm transition-all text-sm"
          >
            <Calculator size={18} className="text-brand-gold" /> LTV Calculator
          </button>
          {hasPermission('Customer Create') && (
            <button
              onClick={() => setShowAddCustomer(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy font-bold rounded-xl shadow-lg transition-all"
            >
              <Plus size={18} /> Add Customer
            </button>
          )}

          {selectedCustomerId && (
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="px-4 py-3 bg-gray-200 dark:bg-brand-matte-card border border-gray-300 dark:border-brand-matte-border hover:bg-gray-300 dark:hover:bg-black rounded-xl text-xs font-bold transition-all"
            >
              Clear Workspace
            </button>
          )}
        </div>
      </div>

      {/* Workspace Display */}
      {!selectedCustomerId ? (
        // NO CUSTOMER SELECTED: Show Directory & Stats
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-wider">Active Approved Loans</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold font-display text-brand-navy dark:text-white">{globalStats.activeLoansCount}</span>
                <div className="p-1.5 bg-green-500/10 text-green-500 rounded-lg"><CheckCircle2 size={16} /></div>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-wider">Outstanding Principal</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold font-display text-brand-navy dark:text-white">{formatCurrency(globalStats.outstandingPrincipal)}</span>
                <div className="p-1.5 bg-brand-gold/10 text-brand-gold rounded-lg"><IndianRupee size={16} /></div>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-wider">Interest Accrued Due</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold font-display text-brand-navy dark:text-white">{formatCurrency(globalStats.outstandingInterest)}</span>
                <div className="p-1.5 bg-brand-gold/10 text-brand-gold rounded-lg"><TrendingUp size={16} /></div>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-wider">Overdue Accounts</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold font-display text-red-500">{(globalStats as any).overdueCount || 0}</span>
                <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg"><AlertTriangle size={16} /></div>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-wider">Upcoming EMI (7 Days)</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold font-display text-brand-navy dark:text-white">{(globalStats as any).upcomingEmiCount || 0}</span>
                <div className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg"><Clock size={16} /></div>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-wider">Today's Collections</span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xl font-bold font-display text-brand-navy dark:text-white">{formatCurrency((globalStats as any).todayCollectionsAmount || 0)}</span>
                <div className="p-1.5 bg-green-500/10 text-green-500 rounded-lg"><CheckCircle2 size={16} /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Directory Listings */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-brand-matte-border bg-gray-50 dark:bg-black/10">
                  <h2 className="text-sm font-bold font-display text-brand-navy dark:text-white">Customer Workspace Directory</h2>
                  <p className="text-xs text-gray-500 dark:text-brand-matte-text mt-0.5">Select a customer profile from the roster to begin operations.</p>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-brand-matte-border">
                  {customersList.length > 0 ? (
                    customersList.slice(0, 5).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-black/40 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-navy dark:bg-black text-brand-gold border border-brand-gold/20 flex items-center justify-center font-bold">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-sm block text-brand-navy dark:text-white">{c.name}</span>
                            <span className="text-xs text-gray-500 dark:text-brand-matte-text inline-flex items-center gap-2">
                              <Phone size={10} /> {c.mobile}
                              {c.email && <span className="inline-flex items-center gap-1"><Mail size={10} /> {c.email}</span>}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-brand-gold" />
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-gray-400 dark:text-brand-matte-text">
                      No active customer profiles found matching filters.
                    </div>
                  )}
                  {customersList.length > 0 && (
                    <div className="p-3 border-t border-gray-100 dark:border-brand-matte-border text-center">
                      
                      <a href="/customers"
                        className="text-[11px] font-bold text-brand-gold hover:underline"
                      >
                        View all {customersList.length} customers →
                      </a>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Right Column: Market Watch & Quick Calculator */}
            <div className="space-y-6">
              {/* Market Watch Widget */}
              <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-white flex items-center gap-1.5">
                    <Activity size={14} className="text-brand-gold animate-pulse" /> Market Watch
                  </h3>
                  <div className="flex items-center gap-2">
                    {/* Map toggle button */}
                    <button
                      onClick={() => setShowMapView(v => !v)}
                      title={showMapView ? 'Show Chart' : 'Show India Price Map'}
                      className={`p-1.5 rounded-lg border transition-all ${
                        showMapView
                          ? 'bg-brand-gold text-brand-navy border-brand-gold'
                          : 'text-gray-400 hover:text-brand-gold border-gray-200 dark:border-brand-matte-border hover:border-brand-gold'
                      }`}
                    >
                      {/* Map pin dot icon */}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
                        <circle cx="12" cy="12" r="9"/>
                      </svg>
                    </button>
                    <select aria-label="-I-"
                      value={marketWatchAsset}
                      onChange={(e) => setMarketWatchAsset(e.target.value)}
                      className="px-2 py-1 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    >
                      {marketRates.length > 0 ? (
                        marketRates.map((mr) => (
                          <option key={mr.id} value={mr.asset}>{mr.asset}</option>
                        ))
                      ) : (
                        <>
                          <option value="GOLD">GOLD</option>
                          <option value="SILVER">SILVER</option>
                          <option value="PLATINUM">PLATINUM</option>
                        </>
                      )}
                    </select>
                    <button
                      onClick={() => handleTriggerSync(marketWatchAsset !== 'GOLD' && marketWatchAsset !== 'SILVER' ? marketWatchAsset : undefined)}
                      className="p-1 text-gray-400 hover:text-brand-gold rounded transition-all"
                      title="Sync Rates from API"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {/* The Chart */}
                {/* The Chart / Map toggle */}
                <div className="h-48 w-full mt-4">
                  {showMapView ? (
                    <IndiaPriceMap
                      rate={selectedMarketRate?.rate || 0}
                      asset={marketWatchAsset}
                      theme={theme}
                    />
                  ) : marketHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={marketHistory}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selectedMarketRate?.dailyChange >= 0 ? "#10B981" : "#EF4444"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={selectedMarketRate?.dailyChange >= 0 ? "#10B981" : "#EF4444"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          labelFormatter={(label) => String(label)}
                          contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#333', fontSize: '12px', color: '#FFF' }}
                          itemStyle={{ color: '#D4AF37' }}
                          formatter={(value: any) => [formatCurrency(value), 'Rate']}
                        />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          stroke={selectedMarketRate?.dailyChange >= 0 ? "#10B981" : "#EF4444"}
                          fillOpacity={1}
                          fill="url(#colorRate)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Loading chart...</div>
                  )}
                </div>

                {/* The Current Rate Display below chart */}
                {selectedMarketRate && (
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold font-display text-brand-navy dark:text-white block">
                        {formatCurrency(selectedMarketRate.rate)}
                        <span className="text-xs text-gray-400 dark:text-brand-matte-text ml-1 font-normal">/g</span>
                      </span>
                      {isRetailMetal(selectedMarketRate.asset) && (
                        <span className="text-[11px] text-gray-500 dark:text-brand-matte-text block mt-1">
                          Est. Indian retail: <strong className="text-brand-navy dark:text-white">{formatCurrency(selectedRetailRate)}/g</strong>
                          <span className="block">API x 1.15 customs x 1.03 GST</span>
                        </span>
                      )}
                      <span className={`text-xs font-bold ${selectedMarketRate.dailyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {selectedMarketRate.dailyChange >= 0 ? '+' : ''}{selectedMarketRate.dailyChange.toFixed(2)}% (24h)
                      </span>
                    </div>
                    {hasPermission('Settings View') && (
                      <button
                        onClick={() => {
                          setEditingAssetRate(selectedMarketRate.asset);
                          setEditingRateValue(String(selectedMarketRate.rate));
                        }}
                        className="p-1.5 bg-gray-100 dark:bg-black text-gray-500 hover:text-brand-gold rounded-lg transition-all"
                        title="Manual Override"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Manual Rate Edit Form */}
                {editingAssetRate === selectedMarketRate?.asset && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-brand-matte-border">
                    <input
                      aria-label="Manual market rate"
                      type="number"
                      step="0.01"
                      value={editingRateValue}
                      onChange={(e) => setEditingRateValue(e.target.value)}
                      className="w-24 px-2 py-1 bg-white dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded text-brand-navy dark:text-white outline-none"
                    />
                    <button
                      onClick={() => handleUpdateManualRate(selectedMarketRate.asset, parseFloat(editingRateValue))}
                      className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs font-bold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingAssetRate(null)}
                      className="px-2 py-1 bg-gray-100 dark:bg-black text-gray-500 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Generate realistic demo history button */}
                <div className="pt-2 border-t border-gray-100 dark:border-brand-matte-border flex justify-end">
                  <button
                    onClick={handleGenerateDemoHistory}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-gold/10 hover:bg-brand-gold/25 border border-brand-gold/30 text-brand-gold text-[10px] font-bold rounded-lg transition-all"
                  >
                    <Activity size={10} /> Generate Demo History
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : (
        // CUSTOMER WORKSPACE IS ACTIVE
        <div id="tour-customer-card" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
          {/* Left Column: Customer Profile Details & Sticky Overview */}
          <div className="space-y-6 lg:sticky lg:top-6">
            {/* Card: Customer Details */}
            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm relative">
              {hasPermission('Customer Delete') && (
                <button
                  onClick={handleDeleteCustomer}
                  className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Soft Delete Customer"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-brand-navy dark:bg-black text-brand-gold border-2 border-brand-gold flex items-center justify-center font-bold text-xl">
                  {workspace?.personalDetails.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display text-brand-navy dark:text-white">{workspace?.personalDetails.name}</h2>
                  <span className="text-xs font-semibold text-brand-gold tracking-widest uppercase">ID: #{workspace?.personalDetails.id}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-brand-gold" />
                  <span>{workspace?.personalDetails.mobile}</span>
                </div>
                {workspace?.personalDetails.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-brand-gold" />
                    <span>{workspace?.personalDetails.email}</span>
                  </div>
                )}
                {workspace?.personalDetails.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-brand-gold" />
                    <span>{workspace?.personalDetails.address}</span>
                  </div>
                )}
                {workspace?.personalDetails.dob && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-brand-gold" />
                    <span>DOB: {new Date(workspace.personalDetails.dob).toLocaleDateString()}</span>
                  </div>
                )}
                {workspace?.personalDetails.occupation && (
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-brand-gold" />
                    <span>Occupation: {workspace.personalDetails.occupation}</span>
                  </div>
                )}
                {workspace?.personalDetails.kycNumber && (
                  <div className="flex items-center gap-2 border-t border-gray-100 dark:border-brand-matte-border pt-3 mt-3">
                    <FileCheck size={14} className="text-brand-gold" />
                    <span className="font-semibold">{workspace.personalDetails.kycInfo?.type || 'KYC'}: {workspace.personalDetails.kycNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card: Outstanding Summaries */}
            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm text-center">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-widest block mb-2">Aggregate Outstanding Balance</span>
              <div className="text-3xl font-bold font-display text-brand-navy dark:text-white">
                ₹{((workspace?.outstandingAmount || 0) + (workspace?.interestDue || 0)).toFixed(2)}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-brand-matte-border text-xs">
                <div>
                  <span className="text-gray-400 dark:text-brand-matte-text block">Principal</span>
                  <span className="font-bold text-brand-navy dark:text-white">₹{workspace?.outstandingAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-brand-matte-text block">Interest Due</span>
                  <span className="font-bold text-brand-gold">₹{workspace?.interestDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Risk Indicator Panel */}
            <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm text-center">
              <span className="text-gray-400 dark:text-brand-matte-text text-[10px] uppercase font-bold tracking-widest block mb-2">Client Credit Risk Status</span>
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${workspace?.personalDetails.riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500' :
                  workspace?.personalDetails.riskLevel === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500' :
                    'bg-green-500/10 text-green-500 ring-1 ring-green-500'
                  }`}>
                  {workspace?.personalDetails.riskLevel} RISK (Score: {workspace?.personalDetails.riskScore})
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Tab Navigation Customer 360 Workspace */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab header selectors */}
            <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-brand-matte-border pb-3">
              <button
                onClick={() => setActiveTab('loans')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'loans' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Loans ({workspace?.activeLoans.length + workspace?.pastLoans.length})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'payments' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Ledger Logs ({workspace?.paymentHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'transactions' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Transactions
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'documents' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Documents ({workspace?.documents.length})
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'notes' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Notes ({workspace?.notes.length})
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'timeline' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Audit Trails
              </button>
              <button
                onClick={() => setActiveTab('risk')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'risk' ? 'bg-brand-gold text-brand-navy font-bold' : 'text-gray-400 dark:text-brand-matte-text hover:bg-gray-100 dark:hover:bg-brand-matte-card'
                  }`}
              >
                Risk Analysis
              </button>
            </div>

            {/* TAB CONTENT: LOANS */}
            {activeTab === 'loans' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Credit & Loan Accounts</h3>
                    {hasPermission('Loan Create') && (
                      <button
                        onClick={() => setShowAddLoan(true)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-gold text-brand-navy font-bold rounded-lg hover:bg-brand-gold-light transition-all"
                      >
                        <Plus size={14} /> New Loan
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workspace?.activeLoans.map((l: any) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedLoanForDetails(l)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedLoanForDetails?.id === l.id
                          ? 'border-brand-gold bg-brand-gold/5 shadow-md'
                          : 'border-gray-200 dark:border-brand-matte-border bg-white dark:bg-black/30 hover:border-brand-gold/50'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs uppercase text-brand-navy dark:text-white">
                            {l.loanType.name}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${l.status.code === 'APPROVED' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                            {l.status.name}
                          </span>
                        </div>
                        <div className="text-xl font-bold font-display text-brand-navy dark:text-white mb-2">
                          ₹{l.amount.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-brand-matte-text">
                          <span>Rate: {l.interestRate}% ({l.interestType.name})</span>
                          <span>Tenure: {l.tenureMonths} mo</span>
                        </div>

                        {l.status.code === 'PENDING' && (
                          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-brand-matte-border">
                            {hasPermission('Loan Approve') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApproveLoan(l.id); }}
                                className="flex-1 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg hover:bg-green-700 transition-all"
                              >
                                Approve
                              </button>
                            )}
                            {hasPermission('Loan Reject') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRejectLoan(l.id); }}
                                className="flex-1 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-all"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}

                        {/* Edit / Delete action row */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-brand-matte-border">
                          {(l.status.code === 'PENDING' || l.status.code === 'DRAFT') && hasPermission('Loan Update') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedLoanForDetails(l); handleOpenEditLoan(l); }}
                              className="flex-1 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-1"
                            >
                              <Edit3 size={10} /> Modify
                            </button>
                          )}
                          {hasPermission('Loan Delete') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSoftDeleteLoan(l.id); }}
                              className="flex-1 py-1 bg-red-600/10 text-red-500 text-[10px] font-bold rounded-lg hover:bg-red-600/20 transition-all flex items-center justify-center gap-1"
                            >
                              <Trash2 size={10} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {workspace?.pastLoans.map((l: any) => (
                      <div
                        key={l.id}
                        onClick={() => setSelectedLoanForDetails(l)}
                        className={`p-4 border rounded-xl cursor-pointer opacity-75 transition-all ${selectedLoanForDetails?.id === l.id
                          ? 'border-brand-gold bg-brand-gold/5 shadow-md'
                          : 'border-gray-200 dark:border-brand-matte-border bg-white dark:bg-black/30'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs uppercase text-brand-navy dark:text-white">
                            {l.loanType.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-gray-500/10 text-gray-500">
                            {l.status.name}
                          </span>
                        </div>
                        <div className="text-xl font-bold font-display text-gray-400 dark:text-gray-500 mb-2">
                          ₹{l.amount.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>Rate: {l.interestRate}% ({l.interestType.name})</span>
                          <span>Tenure: {l.tenureMonths} mo</span>
                        </div>
                      </div>
                    ))}

                    {workspace?.activeLoans.length === 0 && workspace?.pastLoans.length === 0 && (
                      <div className="col-span-2 p-8 text-center border border-dashed border-gray-200 dark:border-brand-matte-border rounded-xl text-gray-400 dark:text-brand-matte-text">
                        No active or historical loan accounts linked to customer.
                      </div>
                    )}
                  </div>
                </div>

                {selectedLoanForDetails && (
                  <div className="space-y-6">
                    {/* Collateral details */}
                    {selectedLoanForDetails.collateral && (
                      <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-white mb-3">Collateral Appraisals</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-gray-400 block">Collateral Type</span>
                            <span className="font-bold text-brand-navy dark:text-white">{selectedLoanForDetails.collateral.type}</span>
                          </div>
                          {selectedLoanForDetails.collateral.weight && (
                            <div>
                              <span className="text-gray-400 block">Weight (grams)</span>
                              <span className="font-bold text-brand-navy dark:text-white">{selectedLoanForDetails.collateral.weight} g</span>
                            </div>
                          )}
                          {selectedLoanForDetails.collateral.purity && (
                            <div>
                              <span className="text-gray-400 block">Purity ({selectedLoanForDetails.collateral.purityUnit})</span>
                              <span className="font-bold text-brand-navy dark:text-white">{selectedLoanForDetails.collateral.purity}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-400 block">Appraised Value At Creation</span>
                            <span className="font-bold text-brand-gold">{formatCurrency(selectedLoanForDetails.collateral.appraisedValueAtLoanCreation)}</span>
                          </div>
                        </div>
                        {selectedLoanForDetails.collateral.description && (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-brand-matte-border">
                            Description: {selectedLoanForDetails.collateral.description}
                          </p>
                        )}

                        {/* Collateral Visual Evidence / Image Gallery */}
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-brand-matte-border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-navy dark:text-white flex items-center gap-1.5">
                              <Camera size={14} className="text-brand-gold" />
                              Visual Proof & Evidence
                            </span>
                            {hasPermission('Loan Update') && (
                              <button
                                onClick={() => collateralFileInputRef.current?.click()}
                                className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-brand-gold text-brand-navy font-bold rounded hover:bg-brand-gold-light transition-all"
                              >
                                <Plus size={10} /> Upload Image
                              </button>
                            )}
                          </div>

                          <input
                            aria-label="Upload collateral image"
                            type="file"
                            ref={collateralFileInputRef}
                            onChange={handleCollateralImageUpload}
                            accept="image/*"
                            className="hidden"
                          />

                          {collateralImages.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                              {collateralImages.map((img: any) => {
                                const backendUrl = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '') : 'http://localhost:5000';
                                const imgSrc = `${backendUrl}/${img.filePath}`;
                                return (
                                  <div
                                    key={img.id}
                                    className="group relative aspect-square border border-gray-200 dark:border-brand-matte-border rounded-lg overflow-hidden bg-gray-50 dark:bg-black/30 hover:border-brand-gold/60 transition-all cursor-pointer"
                                    onClick={() => setCollateralImagePreview(imgSrc)}
                                  >
                                    <img
                                      src={imgSrc}
                                      alt={img.fileName}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {hasPermission('Loan Update') && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteCollateralImage(img.id);
                                        }}
                                        className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100 shadow"
                                        title="Delete image"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    )}
                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[8px] text-white truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      {img.fileName}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div
                              onClick={() => hasPermission('Loan Update') && collateralFileInputRef.current?.click()}
                              className={`border border-dashed border-gray-200 dark:border-brand-matte-border rounded-xl p-6 text-center transition-all ${hasPermission('Loan Update')
                                  ? 'hover:border-brand-gold/50 cursor-pointer hover:bg-brand-gold/5'
                                  : ''
                                }`}
                            >
                              <Image size={24} className="mx-auto text-gray-300 mb-1.5" />
                              <span className="text-[10px] text-gray-400 block">No visual evidence uploaded.</span>
                              {hasPermission('Loan Update') && (
                                <span className="text-[9px] text-brand-gold font-semibold mt-0.5 block">Click to upload collateral files (JPEG, PNG, WEBP)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Amortization Schedule */}
                    <div id="tour-payment-section" className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="border-b border-gray-100 dark:border-brand-matte-border bg-gray-50 dark:bg-black/20 p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-white">Amortization Repayments Schedule</h4>
                      </div>
                      <div className="w-full overflow-x-auto max-h-80">
                        <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-brand-matte-card text-brand-navy dark:text-brand-matte-text border-b border-gray-200 dark:border-brand-matte-border uppercase font-semibold">
                              <th className="p-3 text-center">Inst #</th>
                              <th className="p-3">Due Date</th>
                              <th className="p-3 text-right">Principal</th>
                              <th className="p-3 text-right">Interest</th>
                              <th className="p-3 text-right">Total Installment</th>
                              <th className="p-3 text-right">Paid</th>
                              <th className="p-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-brand-matte-border">
                            {loanSchedule.map((row) => (
                              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-black/30">
                                <td className="p-3 text-center font-semibold">{row.installmentNumber}</td>
                                <td className="p-3">{new Date(row.dueDate).toLocaleDateString()}</td>
                                <td className="p-3 text-right font-mono">{formatCurrency(row.principalAmount)}</td>
                                <td className="p-3 text-right font-mono text-brand-gold">{formatCurrency(row.interestAmount)}</td>
                                <td className="p-3 text-right font-mono font-bold">{formatCurrency(row.totalAmount)}</td>
                                <td className="p-3 text-right font-mono text-green-600">{formatCurrency(row.paidAmount)}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${row.status === 'PAID' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Transaction Payment Ledger</h3>
                    <p className="text-xs text-gray-500 dark:text-brand-matte-text mt-0.5">
                      Check payments ledger and trigger loan post-repayments for selected active credit accounts.
                    </p>
                  </div>

                  {selectedLoanForDetails && selectedLoanForDetails.status.code === 'APPROVED' && hasPermission('Payment Create') && (
                    <button
                      onClick={() => {
                        setPaymentForm((prev) => ({ ...prev, loanId: selectedLoanForDetails.id }));
                        setShowPaymentModal(true);
                      }}
                      className="px-5 py-2.5 bg-brand-navy hover:bg-brand-navy-light text-brand-gold font-bold text-xs uppercase tracking-wider rounded-xl border border-brand-gold shadow-md transition-all flex items-center gap-2 animate-pulse"
                    >
                      <IndianRupee size={14} /> Post Repayment
                    </button>
                  )}
                </div>

                {selectedLoanForDetails ? (
                  <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="w-full overflow-x-auto max-h-96">
                      <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-brand-matte-card text-brand-navy dark:text-brand-matte-text border-b border-gray-200 dark:border-brand-matte-border uppercase font-semibold">
                            <th className="p-3">Tx Date</th>
                            <th className="p-3">Reference No</th>
                            <th className="p-3 text-right">Principal Portion</th>
                            <th className="p-3 text-right">Interest Portion</th>
                            <th className="p-3 text-right">Penalty</th>
                            <th className="p-3 text-right">Total Paid</th>
                            <th className="p-3 text-right">Balance</th>
                            <th className="p-3 text-center">Receipt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-brand-matte-border">
                          {workspace?.paymentHistory
                            .filter((p: any) => p.loanId === selectedLoanForDetails.id)
                            .map((pay: any) => (
                              <tr key={pay.id} className="hover:bg-gray-50 dark:hover:bg-black/30">
                                <td className="p-3">{new Date(pay.paymentDate).toLocaleDateString()}</td>
                                <td className="p-3 font-semibold">{pay.referenceNumber || 'N/A'}</td>
                                <td className="p-3 text-right font-mono text-green-600">{formatCurrency(pay.principalPortion)}</td>
                                <td className="p-3 text-right font-mono text-brand-gold">{formatCurrency(pay.interestPortion)}</td>
                                <td className="p-3 text-right font-mono text-red-500">{formatCurrency(pay.penaltyPortion)}</td>
                                <td className="p-3 text-right font-mono font-bold">{formatCurrency(pay.amount)}</td>
                                <td className="p-3 text-right font-mono">{formatCurrency(pay.remainingBalance)}</td>
                                <td className="p-3 text-center">
                                  <div className="inline-flex items-center justify-center gap-1">
                                    <button
                                      onClick={async () => {
                                        try {
                                          const response = await api.get(`/payments/receipt/${pay.id}`, {
                                            responseType: 'blob',
                                          });
                                          const blob = new Blob([response.data], { type: 'application/pdf' });
                                          const url = window.URL.createObjectURL(blob);
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.download = `receipt_${pay.id}.pdf`;
                                          document.body.appendChild(link);
                                          link.click();
                                          link.remove();
                                          window.URL.revokeObjectURL(url);
                                        } catch (err) {
                                          alert('Failed to download receipt. Please try again.');
                                        }
                                      }}
                                      className="inline-flex p-1 text-brand-gold hover:bg-brand-gold/10 rounded"
                                      title="Download Receipt"
                                    >
                                      <Download size={14} />
                                    </button>
                                    <a
                                      aria-label={`Download receipt for payment ${pay.id}`}
                                      href={`/api/payments/receipt/${pay.id}`}
                                      download
                                      className="inline-flex p-1 text-brand-gold hover:bg-brand-gold/10 rounded"
                                      title="Download receipt"
                                    >
                                      <Download size={14} />
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          {workspace?.paymentHistory.filter((p: any) => p.loanId === selectedLoanForDetails.id).length === 0 && (
                            <tr>
                              <td colSpan={8} className="p-6 text-center text-gray-400 dark:text-brand-matte-text">
                                No payments ledger logs posted.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-brand-matte-card p-12 text-center border border-gray-200 dark:border-brand-matte-border rounded-2xl text-gray-400">
                    Please select a loan account from the Loans tab to check repayment ledgers.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: TRANSACTIONS */}
            {activeTab === 'transactions' && (
              <div className="space-y-4">
                {selectedLoanForDetails ? (
                  <TransactionList loanId={selectedLoanForDetails.id} />
                ) : (
                  <div className="bg-white dark:bg-brand-matte-card p-12 text-center border border-gray-200 dark:border-brand-matte-border rounded-2xl text-gray-400 dark:text-brand-matte-text">
                    Please select a loan account from the Loans tab to view its transaction ledger.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Documents Vault</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Upload client KYC proofs, income certificates, and collateral photos.</p>
                  </div>
                  <label className="p-2 bg-brand-gold text-brand-navy font-bold text-xs rounded-lg hover:bg-brand-gold-light cursor-pointer transition-all flex items-center gap-1">
                    <Plus size={14} /> Upload File
                    <input
                      aria-label="Upload customer document file"
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="w-full max-w-xs">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Document Category</label>
                  <select
                    aria-label="Document category"
                    value={uploadDoc.documentType}
                    onChange={(e) => setUploadDoc((prev) => ({ ...prev, documentType: e.target.value }))}
                    className="w-full text-xs px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none"
                  >
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Collateral Image">Collateral Proof</option>
                    <option value="Income Proof">Income Proof</option>
                    <option value="Other">Other Document</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workspace?.documents.length > 0 ? (
                    workspace.documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-black/40 border border-gray-100 dark:border-brand-matte-border rounded-xl">
                        <div className="flex items-center gap-3 overflow-hidden pr-2 text-xs">
                          <FileText size={18} className="text-brand-gold flex-shrink-0" />
                          <div className="overflow-hidden">
                            <span className="truncate block font-semibold text-brand-navy dark:text-white" title={doc.name}>{doc.name}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">{doc.documentType} | {(doc.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={`/${doc.filePath}`}
                            download
                            className="p-1.5 text-brand-gold hover:bg-brand-gold/10 rounded-lg"
                            title="Download document file"
                          >
                            <Download size={14} />
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                            title="Soft-delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-12 text-center text-gray-400 dark:text-brand-matte-text">
                      No document records uploaded in customer folder.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: NOTES */}
            {activeTab === 'notes' && (
              <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Workspace Notes</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Post custom notes regarding interactions, updates, and valuations.</p>
                  </div>
                  <button
                    onClick={() => setShowAddNote(true)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand-gold text-brand-navy font-bold rounded-lg hover:bg-brand-gold-light transition-all"
                  >
                    <Plus size={14} /> Add Note
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workspace?.notes.length > 0 ? (
                    workspace.notes.map((note: any) => (
                      <div key={note.id} className="p-4 bg-gray-50 dark:bg-black/40 border border-gray-100 dark:border-brand-matte-border rounded-xl relative group">
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="absolute top-3 right-3 text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete Note"
                        >
                          <Trash2 size={14} />
                        </button>
                        <h4 className="font-bold text-xs text-brand-navy dark:text-white">{note.title}</h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        <span className="text-[9px] text-brand-gold block mt-3 font-semibold">{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-12 text-center text-gray-400 dark:text-brand-matte-text">No notes entries filed.</div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: TIMELINE */}
            {activeTab === 'timeline' && (
              <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm">
                <h4 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white mb-6 border-b border-gray-100 dark:border-brand-matte-border pb-3">
                  Account Timeline & Action Logs
                </h4>
                {selectedLoanForDetails ? (
                  <div className="relative border-l-2 border-brand-gold/30 pl-4 ml-2 space-y-6">
                    {loanTimeline.map((item) => (
                      <div key={item.id} className="relative">
                        <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-gold border-2 border-white dark:border-brand-matte-card" />
                        <span className="text-[10px] text-brand-gold font-bold uppercase block tracking-wider">{item.action}</span>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{item.description}</p>
                        <span className="text-[9px] text-gray-400 block mt-1">{new Date(item.createdAt).toLocaleString()} | Operator: {item.createdBy}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-xs py-8">
                    Select a credit loan account from the Loans tab to view timeline action trails.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: RISK PROFILE ANALYSIS */}
            {activeTab === 'risk' && (
              <div className="bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-brand-matte-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Credit Risk Profile Assessment</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Cached evaluations updated automatically on transactions or manually synced.</p>
                  </div>
                  <button
                    onClick={handleRecalculateRisk}
                    className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} /> Recalculate Risk
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-brand-matte-border rounded-xl text-center flex flex-col justify-center">
                    <span className="text-gray-400 text-[10px] font-bold uppercase block">Risk Score</span>
                    <span className="text-4xl font-extrabold text-brand-navy dark:text-white mt-1">
                      {workspace?.personalDetails.riskScore}
                    </span>
                  </div>

                  <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-brand-matte-border rounded-xl text-center flex flex-col justify-center">
                    <span className="text-gray-400 text-[10px] font-bold uppercase block">Risk Level Classification</span>
                    <span className={`text-xl font-bold uppercase mt-2 inline-block mx-auto px-3 py-1 rounded-full ${workspace?.personalDetails.riskLevel === 'HIGH' ? 'bg-red-500/10 text-red-500' :
                      workspace?.personalDetails.riskLevel === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-green-500/10 text-green-500'
                      }`}>
                      {workspace?.personalDetails.riskLevel}
                    </span>
                  </div>

                  <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-brand-matte-border rounded-xl text-xs space-y-1.5 justify-center flex flex-col">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Active Loans:</span>
                      <span className="font-bold text-brand-navy dark:text-white">{workspace?.activeLoans.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Settled Loans:</span>
                      <span className="font-bold text-brand-navy dark:text-white">{workspace?.pastLoans.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Accrued Balances:</span>
                      <span className="font-bold text-brand-navy dark:text-white">
                        ₹{((workspace?.outstandingAmount || 0) + (workspace?.interestDue || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-white">Risk Policy Matrices & Score Factors</h4>
                  <div className="divide-y divide-gray-100 dark:divide-brand-matte-border text-xs">
                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold block">Outstanding Principal Thresholds</span>
                        <span className="text-[10px] text-gray-400 block">Outs. Principal &gt; ₹50,000 (+30 pts) | &gt; ₹10,000 (+15 pts)</span>
                      </div>
                      <span className="font-semibold text-brand-navy dark:text-white">
                        {workspace?.outstandingAmount > 50000 ? '+30 Points Applied' :
                          workspace?.outstandingAmount > 10000 ? '+15 Points Applied' : '0 Points Applied'}
                      </span>
                    </div>

                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold block">Missed Installments Penalty</span>
                        <span className="text-[10px] text-gray-400 block">+20 points per unpaid schedule past due date</span>
                      </div>
                      <span className="font-semibold text-brand-navy dark:text-white">
                        Dynamic (Database Calculated)
                      </span>
                    </div>

                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold block">Active Roster Limits</span>
                        <span className="text-[10px] text-gray-400 block">Active Loans &gt; 3 (+15 points)</span>
                      </div>
                      <span className="font-semibold text-brand-navy dark:text-white">
                        {workspace?.activeLoans.length > 3 ? '+15 Points Applied' : '0 Points Applied'}
                      </span>
                    </div>

                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold block">Credit Roster Discount</span>
                        <span className="text-[10px] text-gray-400 block">-10 points discount for each settled/closed loan account</span>
                      </div>
                      <span className="font-semibold text-green-500">
                        {workspace?.pastLoans.length > 0 ? `-${workspace?.pastLoans.length * 10} Points Discount Applied` : '0 Points Discount'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
          <div className="w-full max-w-lg bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-2xl relative">
            <h3 className="text-lg font-bold font-display text-brand-navy dark:text-white mb-4">Register New Customer</h3>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Full Name *</label>
                  <input
                    aria-label="Customer full name"
                    type="text"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Mobile Number *</label>
                  <input
                    aria-label="Customer mobile number"
                    type="text"
                    required
                    value={newCustomerForm.mobile}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, mobile: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Email Address</label>
                  <input
                    aria-label="Customer email address"
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Date of Birth</label>
                  <input
                    aria-label="Customer date of birth"
                    type="date"
                    value={newCustomerForm.dob}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, dob: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Residential Address</label>
                <textarea
                  aria-label="Customer residential address"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Occupation</label>
                  <input
                    aria-label="Customer occupation"
                    type="text"
                    value={newCustomerForm.occupation}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, occupation: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">KYC Type</label>
                  <select
                    aria-label="Customer KYC type"
                    value={newCustomerForm.kycType}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, kycType: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  >
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">KYC Document Number</label>
                  <input
                    aria-label="Customer KYC document number"
                    type="text"
                    value={newCustomerForm.kycNumber}
                    onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, kycNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD LOAN */}
      {showAddLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-4xl bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold font-display text-brand-navy dark:text-white mb-4">Create Credit Account Loan</h3>

            <form onSubmit={handleAddLoan} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Loan Type *</label>
                  <select
                    aria-label="New loan type"
                    value={newLoanForm.loanTypeId}
                    onChange={(e) => setNewLoanForm((prev) => ({ ...prev, loanTypeId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  >
                    {masters.loanTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Principal Amount (₹) *</label>
                  <input
                    aria-label="New loan principal amount"
                    type="number"
                    step="0.01"
                    required
                    value={newLoanForm.amount}
                    onChange={(e) => setNewLoanForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Interest Type *</label>
                  <select
                    aria-label="New loan interest type"
                    value={newLoanForm.interestTypeId}
                    onChange={(e) => setNewLoanForm((prev) => ({ ...prev, interestTypeId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  >
                    {masters.interestTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Interest Rate (% Annual) *</label>
                  <input
                    aria-label="New loan annual interest rate"
                    type="number"
                    step="0.01"
                    required
                    value={newLoanForm.interestRate}
                    onChange={(e) => setNewLoanForm((prev) => ({ ...prev, interestRate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tenure (Months) *</label>
                  <input
                    aria-label="New loan tenure in months"
                    type="number"
                    required
                    value={newLoanForm.tenureMonths}
                    onChange={(e) => setNewLoanForm((prev) => ({ ...prev, tenureMonths: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Start / Disburse Date *</label>
                  <input
                    aria-label="New loan start date"
                    type="date"
                    required
                    value={newLoanForm.startDate}
                    onChange={(e) => setNewLoanForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              {/* EMI Preview Row */}
              {getLoanFormPreview() !== null && (
                <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl grid grid-cols-3 gap-2 text-center text-xs mt-2">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Estimated EMI</span>
                    <span className="font-bold text-brand-navy dark:text-white block font-mono text-sm mt-0.5">
                      ₹{getLoanFormPreview()!.emi.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Est. Interest</span>
                    <span className="font-bold text-brand-gold block font-mono text-sm mt-0.5">
                      ₹{getLoanFormPreview()!.totalInterest.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Total Payable</span>
                    <span className="font-bold text-brand-navy dark:text-white block font-mono text-sm mt-0.5">
                      ₹{getLoanFormPreview()!.totalPayable.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Collateral Segment */}
              <div className="border-t border-gray-100 dark:border-brand-matte-border pt-4 mt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-white mb-3">Collateral Valuation</h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Asset Category</label>
                    <select
                      aria-label="Collateral asset category"
                      value={newLoanForm.collateralType}
                      onChange={(e) => setNewLoanForm((prev) => ({ ...prev, collateralType: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    >
                      <option value="GOLD">Gold Assets</option>
                      <option value="SILVER">Silver Assets</option>
                      <option value="VEHICLE">Vehicle Title</option>
                      <option value="PROPERTY">Mortgage Real Estate</option>
                      <option value="OTHER">Other Valuable</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Weight (grams) - Gold/Silver</label>
                    <input
                      aria-label="Collateral weight in grams"
                      type="number"
                      step="0.01"
                      value={newLoanForm.collateralWeight}
                      onChange={(e) => setNewLoanForm((prev) => ({ ...prev, collateralWeight: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Purity Unit</label>
                    <select
                      aria-label="Collateral purity unit"
                      value={newLoanForm.purityUnit}
                      onChange={(e) => setNewLoanForm((prev) => ({ ...prev, purityUnit: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    >
                      <option value="KARAT">Karat (out of 24)</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Purity Value - Gold/Silver</label>
                    <input
                      aria-label="Collateral purity value"
                      type="number"
                      step="0.01"
                      value={newLoanForm.collateralPurity}
                      onChange={(e) => setNewLoanForm((prev) => ({ ...prev, collateralPurity: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    />
                  </div>
                </div>

                {/* Collateral Appraisal Preview */}
                {getCollateralAppraisalPreview() !== null && (
                  <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-xl flex items-center justify-between text-xs mb-3 mt-2">
                    <div>
                      <span className="text-gray-500 dark:text-brand-matte-text block font-bold text-[10px] uppercase">Live Estimated Appraised Value</span>
                      <span className="font-bold text-brand-gold text-sm font-mono block mt-0.5">
                        ₹{getCollateralAppraisalPreview()!.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">
                        Based on weight ({newLoanForm.collateralWeight}g) and purity ({newLoanForm.collateralPurity}{newLoanForm.purityUnit === 'KARAT' ? 'K' : '%'}) @ ₹{marketRates.find(mr => mr.asset === newLoanForm.collateralType)?.rate || 0}/g
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewLoanForm(prev => ({ ...prev, collateralValue: getCollateralAppraisalPreview()!.toFixed(2) }))}
                      className="px-2.5 py-1 bg-brand-gold text-brand-navy font-bold rounded text-[10px] hover:bg-brand-gold-light transition-all"
                    >
                      Use Preview Value
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Appraised Value (₹)</label>
                    <input
                      aria-label="Collateral appraised value"
                      type="number"
                      step="0.01"
                      value={newLoanForm.collateralValue}
                      onChange={(e) => setNewLoanForm((prev) => ({ ...prev, collateralValue: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Verification / Description Details</label>
                    <input
                      aria-label="Collateral verification description"
                      type="text"
                      value={newLoanForm.collateralDescription}
                      onChange={(e) => setNewLoanForm((prev) => ({ ...prev, collateralDescription: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                    />
                  </div>
                </div>

                {/* ── Collateral Photo Upload (optional) ───────────────────────── */}
                <div className="mt-4">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-2">
                    Collateral Photos <span className="text-gray-400 normal-case font-normal">(optional – JPG / PNG / WEBP)</span>
                  </label>

                  {/* Hidden file input accepts multiple uploaded collateral photos. */}
                  <input
                    aria-label="New loan collateral photos"
                    ref={newLoanCollateralInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleNewLoanCollateralImageSelect}
                  />

                  {/* Upload / Camera buttons */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (newLoanCollateralInputRef.current) {
                          newLoanCollateralInputRef.current.removeAttribute('capture');
                          newLoanCollateralInputRef.current.click();
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-black dark:hover:bg-brand-matte-border border border-gray-200 dark:border-brand-matte-border rounded-lg text-[11px] font-semibold text-gray-600 dark:text-gray-300 transition-all"
                    >
                      <Image size={13} />
                      Upload Photo
                    </button>

                    <button
                      type="button"
                      onClick={openCollateralCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-black dark:hover:bg-brand-matte-border border border-gray-200 dark:border-brand-matte-border rounded-lg text-[11px] font-semibold text-gray-600 dark:text-gray-300 transition-all"
                    >
                      <Camera size={13} />
                      Click from Camera
                    </button>
                  </div>

                  {/* Image preview grid */}
                  {pendingCollateralImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pendingCollateralImages.map((img, idx) => (
                        <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-brand-matte-border">
                          <img
                            src={img.preview}
                            alt={img.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            aria-label={`Remove pending collateral photo ${img.name}`}
                            type="button"
                            onClick={() => handleRemovePendingCollateralImage(idx)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} className="text-white" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">No photos added yet. Photos will be attached to the collateral record after loan creation.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddLoan(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg"
                >
                  Disburse & Create Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COLLATERAL CAMERA CAPTURE */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-brand-matte-border">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-navy dark:text-white">Collateral Camera</h3>
              <button
                type="button"
                aria-label="Close camera"
                onClick={closeCollateralCamera}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {cameraError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
                  {cameraError}
                </div>
              ) : (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-video bg-black rounded-xl object-cover border border-gray-200 dark:border-brand-matte-border"
                />
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCollateralCamera}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-black dark:hover:bg-brand-matte-border border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500"
                >
                  Cancel
                </button>
                {!cameraError && (
                  <button
                    type="button"
                    onClick={captureCollateralPhoto}
                    className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg flex items-center gap-1.5"
                  >
                    <Camera size={14} /> Capture Photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NOTE */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-2xl relative">
            <h3 className="text-lg font-bold font-display text-brand-navy dark:text-white mb-4">Add Customer Workspace Note</h3>

            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Title *</label>
                <input
                  aria-label="Note title"
                  type="text"
                  required
                  value={noteForm.title}
                  onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Content details *</label>
                <textarea
                  aria-label="Note content details"
                  required
                  value={noteForm.content}
                  onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddNote(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROCESS PAYMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-2xl relative">
            <h3 className="text-lg font-bold font-display text-brand-navy dark:text-white mb-4">Post Ledger Repayment</h3>

            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Allocation Category *</label>
                <select
                  aria-label="Payment allocation category"
                  value={paymentForm.paymentTypeCode}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentTypeCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                >
                  {masters.paymentTypes.map((t: any) => (
                    <option key={t.id} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Amount (₹) *</label>
                <input
                  aria-label="Payment amount"
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                />
              </div>

              {/* Conditional options for Principal Only payment */}
              {paymentForm.paymentTypeCode === 'PRINCIPAL_ONLY' && (
                <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-lg space-y-2">
                  <span className="block text-[10px] uppercase font-bold text-brand-gold">Principal Prepayment Recalculation Rules</span>

                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          aria-label="Reduce EMI after principal prepayment"
                          type="radio"
                        name="principalOption"
                        value="REDUCE_EMI"
                        checked={paymentForm.principalReductionOption === 'REDUCE_EMI'}
                        onChange={() => setPaymentForm((prev) => ({ ...prev, principalReductionOption: 'REDUCE_EMI' }))}
                      />
                      <span>Option A: Reduce EMI</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        aria-label="Reduce tenure after principal prepayment"
                        type="radio"
                        name="principalOption"
                        value="REDUCE_TENURE"
                        checked={paymentForm.principalReductionOption === 'REDUCE_TENURE'}
                        onChange={() => setPaymentForm((prev) => ({ ...prev, principalReductionOption: 'REDUCE_TENURE' }))}
                      />
                      <span>Option B: Reduce Tenure</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Bank Reference No</label>
                  <input
                    aria-label="Bank reference number"
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Notes / Narration</label>
                  <input
                    aria-label="Payment notes"
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LOAN */}
      {showEditLoanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-2xl relative">
            <h3 className="text-lg font-bold font-display text-brand-navy dark:text-white mb-4">Modify Loan Parameters</h3>

            <form onSubmit={handleUpdateLoan} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Loan Category *</label>
                <select
                  aria-label="Edit loan category"
                  value={editLoanForm.loanTypeId}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, loanTypeId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                >
                  {masters.loanTypes.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Disbursed Principal Amount (₹) *</label>
                <input
                  aria-label="Edit loan disbursed principal amount"
                  type="number"
                  step="0.01"
                  required
                  value={editLoanForm.amount}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Interest Category *</label>
                  <select
                    aria-label="Edit loan interest category"
                    value={editLoanForm.interestTypeId}
                    onChange={(e) => setEditLoanForm((prev) => ({ ...prev, interestTypeId: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  >
                    {masters.interestTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Interest Rate (% p.a.) *</label>
                  <input
                    aria-label="Edit loan annual interest rate"
                    type="number"
                    step="0.01"
                    required
                    value={editLoanForm.interestRate}
                    onChange={(e) => setEditLoanForm((prev) => ({ ...prev, interestRate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tenure (Months) *</label>
                  <input
                    aria-label="Edit loan tenure in months"
                    type="number"
                    required
                    value={editLoanForm.tenureMonths}
                    onChange={(e) => setEditLoanForm((prev) => ({ ...prev, tenureMonths: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Start Date *</label>
                  <input
                    aria-label="Edit loan start date"
                    type="date"
                    required
                    value={editLoanForm.startDate}
                    onChange={(e) => setEditLoanForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-xs rounded-lg text-brand-navy dark:text-white focus:ring-1 focus:ring-brand-gold outline-none"
                  />
                </div>
              </div>

              {/* EMI Preview Row */}
              {getEditLoanFormPreview() !== null && (
                <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl grid grid-cols-3 gap-2 text-center text-xs mt-2">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Estimated EMI</span>
                    <span className="font-bold text-brand-navy dark:text-white block font-mono text-sm mt-0.5">
                      ₹{getEditLoanFormPreview()!.emi.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Est. Interest</span>
                    <span className="font-bold text-brand-gold block font-mono text-sm mt-0.5">
                      ₹{getEditLoanFormPreview()!.totalInterest.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Total Payable</span>
                    <span className="font-bold text-brand-navy dark:text-white block font-mono text-sm mt-0.5">
                      ₹{getEditLoanFormPreview()!.totalPayable.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-6 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditLoanModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-brand-matte-card dark:hover:bg-black border border-gray-200 dark:border-brand-matte-border text-xs font-semibold rounded-lg text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-navy font-bold text-xs rounded-lg"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COLLATERAL IMAGE LIGHTBOX */}
      {collateralImagePreview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setCollateralImagePreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent" onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close collateral image preview"
              onClick={() => setCollateralImagePreview(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-all bg-black/40 rounded-full hover:bg-black/60"
            >
              <X size={20} />
            </button>
            <img
              src={collateralImagePreview}
              alt="Collateral Proof Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* MODAL: QUICK LTV CALCULATOR */}
      {showQuickCalc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-6 rounded-2xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-display text-brand-navy dark:text-white flex items-center gap-2">
                <Calculator size={18} className="text-brand-gold" /> Quick LTV Calculator
              </h3>
              <button aria-label="Close calculator"
                onClick={() => setShowQuickCalc(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-black rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Asset Class</label>
                <select aria-label="Asset class"
                  value={quickCalc.asset}
                  onChange={(e) => setQuickCalc((prev) => ({ ...prev, asset: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  <option value="GOLD">Gold Assets</option>
                  <option value="SILVER">Silver Assets</option>
                  <option value="VEHICLE">Vehicle Title</option>
                  <option value="PROPERTY">Mortgage Property</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Weight / Qty</label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={quickCalc.weight}
                    onChange={(e) => setQuickCalc((prev) => ({ ...prev, weight: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Purity Unit</label>
                  <select aria-label="-II-"
                    value={quickCalc.purityUnit}
                    onChange={(e) => setQuickCalc((prev) => ({ ...prev, purityUnit: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  >
                    <option value="KARAT">Karat (out of 24)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Purity Value</label>
                  <input
                    type="number"
                    placeholder="e.g. 22 or 91.6"
                    value={quickCalc.purity}
                    onChange={(e) => setQuickCalc((prev) => ({ ...prev, purity: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Tenure (Months)</label>
                  <input aria-label="Weight or quantity"
                    type="number"
                    value={quickCalc.tenure}
                    onChange={(e) => setQuickCalc((prev) => ({ ...prev, tenure: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Annual Rate (%)</label>
                  <input aria-label="-III-"
                    type="number"
                    value={quickCalc.interestRate}
                    onChange={(e) => setQuickCalc((prev) => ({ ...prev, interestRate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Interest Logic</label>
                  <select aria-label="Select Calculator"
                    value={quickCalc.interestType}
                    onChange={(e) => setQuickCalc((prev) => ({ ...prev, interestType: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  >
                    <option value="SIMPLE">Simple Flat</option>
                    <option value="COMPOUND">Compound Reducing</option>
                  </select>
                </div>
              </div>

              {/* Results */}
              {(() => {
                const weightVal = parseFloat(quickCalc.weight) || 0;
                const purityVal = parseFloat(quickCalc.purity) || 0;
                const rateVal = parseFloat(quickCalc.interestRate) || 0;
                const tenureVal = parseInt(quickCalc.tenure) || 0;
                const liveRate = marketRates.find((mr) => mr.asset === quickCalc.asset)?.rate ||
                  (quickCalc.asset === 'GOLD' ? 75 : quickCalc.asset === 'SILVER' ? 0.90 : 1);
                const purityRatio = quickCalc.purityUnit === 'KARAT' ? purityVal / 24 : purityVal / 100;
                const appraisedValue = weightVal * liveRate * (purityVal > 0 ? purityRatio : 1);
                const ltvVal = quickCalc.asset === 'GOLD' ? 0.75 : quickCalc.asset === 'SILVER' ? 0.60 : quickCalc.asset === 'VEHICLE' ? 0.70 : 0.50;
                const eligibleAmount = appraisedValue * ltvVal;
                let emi = 0;
                if (eligibleAmount > 0 && rateVal > 0 && tenureVal > 0) {
                  if (quickCalc.interestType === 'COMPOUND') {
                    const monthlyRate = rateVal / 12 / 100;
                    emi = (eligibleAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureVal)) / (Math.pow(1 + monthlyRate, tenureVal) - 1);
                  } else {
                    emi = (eligibleAmount + (eligibleAmount * (rateVal / 100) * (tenureVal / 12))) / tenureVal;
                  }
                }
                return (
                  <div className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-xl space-y-2 mt-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Live Asset Rate:</span>
                      <span className="font-bold text-brand-navy dark:text-white">₹{liveRate.toFixed(2)}/g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Appraised Value:</span>
                      <span className="font-bold text-brand-navy dark:text-white">₹{appraisedValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">LTV Ratio:</span>
                      <span className="font-bold text-brand-navy dark:text-white">{(ltvVal * 100)}%</span>
                    </div>
                    <div className="flex justify-between border-t border-brand-gold/25 pt-2">
                      <span className="text-brand-gold font-bold">Eligible Credit:</span>
                      <span className="font-bold text-brand-gold">₹{eligibleAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Projected Monthly EMI:</span>
                      <span className="font-bold text-brand-navy dark:text-white">₹{emi.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

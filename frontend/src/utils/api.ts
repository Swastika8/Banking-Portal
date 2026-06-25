import axios from 'axios';
import { toast } from 'react-hot-toast';

// Get API URL from environment or use default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds timeout
});

// Request interceptor - Add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('lms_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            localStorage.removeItem('lms_token');
            localStorage.removeItem('lms_refresh_token');
            localStorage.removeItem('lms_user');
            window.location.href = '/login';
            toast.error('Session expired. Please login again.');
        }

        // Handle 403 Forbidden
        if (error.response?.status === 403) {
            toast.error('You do not have permission to perform this action.');
        }

        // Handle network errors
        if (error.code === 'ECONNABORTED') {
            toast.error('Request timeout. Please try again.');
        }

        if (!error.response) {
            toast.error('Network error. Please check your connection.');
        }

        return Promise.reject(error);
    }
);

// Helper functions for common API calls
export const apiService = {
    // Auth
    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),

    register: (data: any) =>
        api.post('/auth/register', data),

    logout: () =>
        api.post('/auth/logout'),

    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),

    resetPassword: (token: string, password: string) =>
        api.post('/auth/reset-password', { token, password }),

    changePassword: (oldPassword: string, newPassword: string) =>
        api.post('/auth/change-password', { oldPassword, newPassword }),

    // Customers
    getCustomers: (params?: any) =>
        api.get('/customers', { params }),

    getCustomer: (id: string) =>
        api.get(`/customers/${id}`),

    createCustomer: (data: any) =>
        api.post('/customers', data),

    updateCustomer: (id: string, data: any) =>
        api.put(`/customers/${id}`, data),

    deleteCustomer: (id: string) =>
        api.delete(`/customers/${id}`),

    searchCustomers: (query: string) =>
        api.get(`/customers/search?q=${query}`),

    // Loans
    getLoans: (params?: any) =>
        api.get('/loans', { params }),

    getLoan: (id: string) =>
        api.get(`/loans/${id}`),

    createLoan: (data: any) =>
        api.post('/loans', data),

    updateLoan: (id: string, data: any) =>
        api.put(`/loans/${id}`, data),

    approveLoan: (id: string) =>
        api.post(`/loans/${id}/approve`),

    rejectLoan: (id: string, reason: string) =>
        api.post(`/loans/${id}/reject`, { reason }),

    closeLoan: (id: string) =>
        api.post(`/loans/${id}/close`),

    // Payments
    getPayments: (params?: any) =>
        api.get('/payments', { params }),

    getPayment: (id: string) =>
        api.get(`/payments/${id}`),

    createPayment: (data: any) =>
        api.post('/payments', data),

    getTodayCollections: () =>
        api.get('/payments/today'),

    getUpcomingEMI: (days: number = 7) =>
        api.get(`/payments/upcoming?days=${days}`),

    // Market Rates
    getMarketRates: () =>
        api.get('/market-rates'),

    getMarketRate: (id: string) =>
        api.get(`/market-rates/${id}`),

    createMarketRate: (data: any) =>
        api.post('/market-rates', data),

    updateMarketRate: (id: string, data: any) =>
        api.put(`/market-rates/${id}`, data),

    syncMarketRates: () =>
        api.post('/market-rates/sync'),

    // Reports
    getReports: (params?: any) =>
        api.get('/reports', { params }),

    generateReport: (type: string, params?: any) =>
        api.post(`/reports/${type}`, params),

    exportReport: (type: string, format: string, params?: any) =>
        api.post(`/reports/${type}/export`, { format, ...params }, {
            responseType: 'blob',
        }),

    // Dashboard
    getDashboardStats: () =>
        api.get('/dashboard/stats'),

    // Settings
    getSettings: () =>
        api.get('/settings'),

    updateSettings: (data: any) =>
        api.put('/settings', data),

    // Masters
    getMasters: (type: string) =>
        api.get(`/masters/${type}`),

    createMaster: (type: string, data: any) =>
        api.post(`/masters/${type}`, data),

    updateMaster: (type: string, id: string, data: any) =>
        api.put(`/masters/${type}/${id}`, data),

    deleteMaster: (type: string, id: string) =>
        api.delete(`/masters/${type}/${id}`),

    // Audit Logs
    getAuditLogs: (params?: any) =>
        api.get('/audit-logs', { params }),

    // Notifications
    getNotifications: () =>
        api.get('/notifications'),

    markNotificationRead: (id: string) =>
        api.put(`/notifications/${id}/read`),

    markAllNotificationsRead: () =>
        api.put('/notifications/read-all'),
};

export default api;
import axios from 'axios';
import { Archive } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export const archiveApi = {
  createArchive: async (url: string): Promise<Archive> => {
    // Use a longer timeout for archive creation since it can take several minutes
    const response = await api.post('/api/archives', { url }, {
      timeout: 300000, // 5 minutes
    });
    return response.data.data;
  },

  getArchives: async (): Promise<Archive[]> => {
    const response = await api.get('/api/archives');
    return response.data.data;
  },

  getArchive: async (id: string): Promise<Archive> => {
    const response = await api.get(`/api/archives/${id}`);
    return response.data.data;
  },

  deleteArchive: async (id: string): Promise<void> => {
    await api.delete(`/api/archives/${id}`);
  },

  getArchiveVersions: async (url: string): Promise<Archive[]> => {
    const encodedUrl = encodeURIComponent(url);
    const response = await api.get(`/api/archives/versions/${encodedUrl}`);
    return response.data.data;
  },

  getGroupedArchives: async (): Promise<{ [url: string]: Archive[] }> => {
    const response = await api.get('/api/archives/grouped');
    return response.data.data;
  },

  getArchiveProgress: async (id: string): Promise<any> => {
    const response = await api.get(`/api/archives/${id}/progress`);
    return response.data.data;
  },
};

export default api;
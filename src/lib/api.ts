import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * The portal's one API client. It carries no token (spec 0003, AC-36): every call sends the
 * `welinc_sso` cookie instead, which welinc-auth sets HttpOnly on `/auth`.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

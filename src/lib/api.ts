import axios from 'axios';

/** The gateway address, checked before dev or build starts (env.schema.ts, spec 0010). */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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

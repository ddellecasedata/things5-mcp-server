import axios from "axios";
import { THINGS5_BASE_URL } from '../config.js';

export async function fetchFirstOrganizationId(auth_token: string): Promise<string> {
  const url = `${THINGS5_BASE_URL}/organizations`;
  const resp = await axios.get(url, {
    headers: auth_token ? { Authorization: `Bearer ${auth_token}` } : undefined
  });
  // API returns { data: [{ id: ... }] }
  const orgs = resp.data?.data || [];
  if (!Array.isArray(orgs) || orgs.length === 0 || !orgs[0].id) {
    throw new Error("No organizations found for the user");
  }
  return orgs[0].id;
}

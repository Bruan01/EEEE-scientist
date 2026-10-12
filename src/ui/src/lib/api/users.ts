import { apiClient } from "./client";
import { getCachedValue, setCachedValue } from "./cache";
import type { UILanguage } from '@/lib/i18n/types'

const PROFILE_CACHE_KEY = "ds:user-profile";
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

export interface UserProfile {
  id: string;
  email: string;
  secondary_email?: string | null;
  username: string;
  role: string;
  user_type: string;
  ui_language?: UILanguage;
  is_active: boolean;
  google_id?: string | null;
  google_name?: string | null;
  google_picture?: string | null;
  avatar_url?: string | null;
  created_at: string;
  last_login_at?: string | null;
  nationality?: string | null;
  institution?: string | null;
  title?: string | null;
  degree?: string | null;
  google_scholar_url?: string | null;
  openreview_url?: string | null;
  dblp_url?: string | null;
  orcid?: string | null;
}



export interface UserVerificationInfo {
  id: string;
  provider: string;
  status: string;
  subject_id?: string | null;
  profile_url?: string | null;
  display_name?: string | null;
  affiliation?: string | null;
  verified_email_domain?: string | null;
  verified_email_domains?: string[];
  works_count?: number | null;
  citations_all?: number | null;
  h_index_all?: number | null;
  i10_index_all?: number | null;
  failure_reason?: string | null;
  verified_at?: string | null;
  consumed_at?: string | null;
  created_at: string;
}

export interface UserVerificationSummary {
  verification?: UserVerificationInfo | null;
}

export interface GithubIdentityStartResponse {
  authorization_url: string;
  expires_at: string;
}

export interface GithubPushStartResponse {
  authorization_url: string;
  expires_at: string;
}

export interface GithubPushInstallationBindRequest {
  installation_id: number;
  state?: string | null;
  account_login?: string | null;
  account_type?: string | null;
  repositories_scope?: string | null;
  permissions_json?: Record<string, unknown> | null;
}

export interface GithubPushInstallationBindResponse {
  installation_id: number;
  status: string;
  account_login?: string | null;
  account_type?: string | null;
}

export interface UserIntegrationsResponse {
  github_identity: {
    bound: boolean;
    github_id?: string | null;
    github_login?: string | null;
  };
  github_push: {
    app_configured: boolean;
    installation_bound: boolean;
    installation_id?: number | null;
    account_login?: string | null;
    account_type?: string | null;
    status?: string | null;
    quest_binding_count?: number;
    enabled_quest_count?: number;
  };
  orcid: {
    bound: boolean;
    orcid?: string | null;
  };
  scholar: {
    bound: boolean;
    profile_url?: string | null;
    subject_id?: string | null;
  };
}

export interface UserProfileUpdate {
  username?: string | null;
  nationality?: string | null;
  institution?: string | null;
  title?: string | null;
  degree?: string | null;
  ui_language?: UILanguage | null;
  google_scholar_url?: string | null;
  openreview_url?: string | null;
  dblp_url?: string | null;
  orcid?: string | null;
}

export async function getMyProfile(forceRefresh: boolean = true): Promise<UserProfile> {
  if (!forceRefresh) {
    const cached = getCachedValue<UserProfile>(PROFILE_CACHE_KEY);
    if (cached) return cached;
  }
  const response = await apiClient.get<UserProfile>("/api/v1/users/me");
  setCachedValue(PROFILE_CACHE_KEY, response.data, PROFILE_CACHE_TTL_MS);
  return response.data;
}

export async function updateMyProfile(payload: UserProfileUpdate): Promise<UserProfile> {
  const response = await apiClient.put<UserProfile>("/api/v1/users/me", payload);
  setCachedValue(PROFILE_CACHE_KEY, response.data, PROFILE_CACHE_TTL_MS);
  return response.data;
}

export async function updateMyAvatar(file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.put<UserProfile>("/api/v1/users/me/avatar", formData);
  setCachedValue(PROFILE_CACHE_KEY, response.data, PROFILE_CACHE_TTL_MS);
  return response.data;
}

export async function deleteMyAvatar(): Promise<UserProfile> {
  const response = await apiClient.delete<UserProfile>("/api/v1/users/me/avatar");
  setCachedValue(PROFILE_CACHE_KEY, response.data, PROFILE_CACHE_TTL_MS);
  return response.data;
}


export async function getMyVerificationSummary(): Promise<UserVerificationSummary> {
  const response = await apiClient.get<UserVerificationSummary>("/api/v1/users/me/verification");
  return response.data;
}

export async function startMyGithubIdentityLink(
  returnPath: string = "/settings"
): Promise<GithubIdentityStartResponse> {
  const response = await apiClient.get<GithubIdentityStartResponse>("/api/v1/auth/github/start", {
    params: { purpose: 'link_identity', return_path: returnPath },
  });
  return response.data;
}

export async function startMyGithubStarMissionAuthorization(
  returnPath: string = "/"
): Promise<GithubIdentityStartResponse> {
  const response = await apiClient.get<GithubIdentityStartResponse>("/api/v1/auth/github/start", {
    params: { purpose: 'star_mission', return_path: returnPath },
  });
  return response.data;
}

export async function verifyMyScholarProfile(value: string): Promise<UserVerificationInfo> {
  const response = await apiClient.post<UserVerificationInfo>("/api/v1/users/me/scholar/verify", {
    value,
  });
  return response.data;
}

export async function getMyIntegrations(
  options?: { syncGithubPush?: boolean }
): Promise<UserIntegrationsResponse> {
  const response = await apiClient.get<UserIntegrationsResponse>("/api/v1/users/me/integrations", {
    params: options?.syncGithubPush ? { sync_github_push: true } : undefined,
  });
  return response.data;
}

export async function startMyGithubPushBinding(
  returnPath: string = "/settings"
): Promise<GithubPushStartResponse> {
  const response = await apiClient.get<GithubPushStartResponse>("/api/v1/users/me/github-push/start", {
    params: { return_path: returnPath },
  });
  return response.data;
}

export async function bindMyGithubPushInstallation(
  payload: GithubPushInstallationBindRequest
): Promise<GithubPushInstallationBindResponse> {
  const response = await apiClient.post<GithubPushInstallationBindResponse>(
    "/api/v1/users/me/github-push/installations",
    payload
  );
  return response.data;
}

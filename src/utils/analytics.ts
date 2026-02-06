// Copyright(c) ZenML GmbH 2024. All Rights Reserved.
// Licensed under the Apache License, Version 2.0(the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing
// permissions and limitations under the License.

import * as crypto from 'crypto';

export type ErrorKind =
  | 'lsp_not_ready'
  | 'lsp_request_failed'
  | 'lsp_response_error'
  | 'validation_error'
  | 'runtime_error'
  | 'authorization_error'
  | 'network_error'
  | 'timeout'
  | 'unknown';

export type ErrorSource =
  | 'extension'
  | 'lsp_transport'
  | 'lsp_response'
  | 'python_backend'
  | 'unknown';

export type ErrorPhase = 'preflight' | 'request' | 'response';

export interface SanitizedAnalyticsError {
  errorKind: ErrorKind;
  errorSource: ErrorSource;
  messageHash: string;
}

/**
 * Compute a SHA-256 hex hash of a string.
 */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

const URL_REGEX = /https?:\/\/[^\s"'`,;)}\]]+/gi;
const PATH_REGEX = /(?:\/[\w.-]+){2,}|[A-Z]:\\[\w\\.-]+/gi;
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX_TOKEN_REGEX = /\b[0-9a-f]{32,}\b/gi;

/**
 * Normalizes a string for hashing by removing URLs, paths, UUIDs, and tokens.
 * The returned value is only for hashing and MUST NOT be emitted directly.
 */
export function normalizeForHash(input: string): string {
  return input
    .replace(URL_REGEX, '<url>')
    .replace(PATH_REGEX, '<path>')
    .replace(UUID_REGEX, '<uuid>')
    .replace(HEX_TOKEN_REGEX, '<token>')
    .trim()
    .toLowerCase();
}

/**
 * Type guard for objects that look like error responses (have an `error` property).
 */
export function isErrorLikeResponse(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

/**
 * Classify an error into a privacy-safe taxonomy + stable hash.
 * Never returns raw error messages.
 */
export function sanitizeErrorForAnalytics(
  err: unknown,
  options?: { operation?: string; phase?: ErrorPhase; isResponseError?: boolean }
): SanitizedAnalyticsError {
  const phase = options?.phase;
  const isResponse = options?.isResponseError ?? phase === 'response';
  const rawMessage = extractErrorMessage(err);
  const normalized = normalizeForHash(rawMessage);

  return {
    errorKind: classifyErrorKind(rawMessage, phase, isResponse),
    errorSource: classifyErrorSource(phase, isResponse),
    messageHash: sha256Hex(normalized),
  };
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.error === 'string') {
      return obj.error;
    }
    if (typeof obj.message === 'string') {
      return obj.message;
    }
  }
  return String(err);
}

function classifyErrorKind(message: string, phase?: ErrorPhase, isResponse?: boolean): ErrorKind {
  const lower = message.toLowerCase();

  if (lower.includes('not ready') || lower.includes('not initialized')) {
    return 'lsp_not_ready';
  }
  if (lower.includes('authorization') || lower.includes('auth failed') || lower.includes('401')) {
    return 'authorization_error';
  }
  if (lower.includes('validationerror') || lower.includes('validation error')) {
    return 'validation_error';
  }
  if (lower.includes('runtimeerror') || lower.includes('runtime error')) {
    return 'runtime_error';
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return 'timeout';
  }
  if (
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('ssl')
  ) {
    return 'network_error';
  }

  if (phase === 'preflight') {
    return 'lsp_not_ready';
  }
  if (isResponse) {
    return 'lsp_response_error';
  }
  if (phase === 'request') {
    return 'lsp_request_failed';
  }

  return 'unknown';
}

function classifyErrorSource(phase?: ErrorPhase, isResponse?: boolean): ErrorSource {
  if (phase === 'preflight') {
    return 'extension';
  }
  if (isResponse) {
    return 'lsp_response';
  }
  if (phase === 'request') {
    return 'lsp_transport';
  }
  return 'unknown';
}

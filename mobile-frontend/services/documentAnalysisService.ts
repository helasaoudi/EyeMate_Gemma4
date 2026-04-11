import axios from 'axios';
import { BACKEND_CONFIG } from '../config/backendConfig';
import { waitForBackendModelReady } from './waitForBackendModel';

export type DocumentType =
  | 'facture'
  | 'recu'
  | 'cin'
  | 'passeport'
  | 'ticket'
  | 'guichet'
  | 'contrat'
  | 'lettre'
  | 'formulaire'
  | 'carte'
  | 'autre';

export interface AnalysisResult {
  type: DocumentType;
  summary: string;
  details: string;
}

interface DocumentAnalyzeJson {
  type: string;
  summary: string;
  details: string;
}

class DocumentAnalysisService {
  async analyzeDocumentWithOCR(
    imageBase64: string,
    language: 'fr' | 'en' = 'fr'
  ): Promise<AnalysisResult> {
    await waitForBackendModelReady();

    const res = await axios.post<DocumentAnalyzeJson>(
      BACKEND_CONFIG.DOCUMENT_URL,
      {
        image_base64: imageBase64,
        language,
      },
      {
        timeout: BACKEND_CONFIG.DOCUMENT_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          ...BACKEND_CONFIG.COMMON_HEADERS,
        },
        validateStatus: () => true,
      }
    );

    if (res.status < 200 || res.status >= 300) {
      const text =
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      throw new Error(text || `Document analysis failed: HTTP ${res.status}`);
    }

    const data = res.data;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON from document analysis server');
    }

    const t = (data.type || 'autre').toLowerCase();
    const allowed: DocumentType[] = [
      'facture',
      'recu',
      'cin',
      'passeport',
      'ticket',
      'guichet',
      'contrat',
      'lettre',
      'formulaire',
      'carte',
      'autre',
    ];
    const docType = (allowed.includes(t as DocumentType) ? t : 'autre') as DocumentType;

    return {
      type: docType,
      summary: data.summary ?? '',
      details: data.details ?? '',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(BACKEND_CONFIG.HEALTH_URL, {
        method: 'GET',
        headers: { ...BACKEND_CONFIG.COMMON_HEADERS },
      });
      if (!res.ok) return false;
      const j = (await res.json()) as { status?: string };
      return j.status === 'ready';
    } catch {
      return false;
    }
  }
}

export default new DocumentAnalysisService();

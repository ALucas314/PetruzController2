import { apiConfig, ApiResponse, ApiError, getAuthHeaders } from "./config";

/**
 * Cliente HTTP para comunicação com a API
 */

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = apiConfig.timeout
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Timeout na requisição", 408);
    }
    throw error;
  }
}

/**
 * Faz uma requisição GET
 */
export async function get<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithTimeout(
      `${apiConfig.baseURL}${endpoint}`,
      {
        ...options,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `Erro ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Mensagem mais clara para erro de conexão
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      throw new ApiError(
        "Servidor backend não está rodando. Por favor, inicie o servidor com: cd server && npm run dev",
        503
      );
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : "Erro desconhecido"
    );
  }
}

/**
 * Faz uma requisição POST
 */
export async function post<T = any>(
  endpoint: string,
  body: any,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithTimeout(
      `${apiConfig.baseURL}${endpoint}`,
      {
        ...options,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
          ...options.headers,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `Erro ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Mensagem mais clara para erro de conexão
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      throw new ApiError(
        "Servidor backend não está rodando. Por favor, inicie o servidor com: cd server && npm run dev",
        503
      );
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : "Erro desconhecido"
    );
  }
}

import Foundation

/// Main API client for WellsAI backend communication
actor WellsAPIClient {
    static let shared = WellsAPIClient()

    private let baseURL = "https://wellsonyx.io/api"
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)
    }

    // MARK: - Chat API

    /// Send a message to WellsAI and receive a response
    func sendMessage(_ content: String, conversationId: String? = nil) async throws -> ChatResponse {
        var request = try makeRequest(endpoint: "/chat/unified", method: "POST")

        let body = ChatRequest(
            message: content,
            conversationId: conversationId,
            product: "wellsai"
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try JSONDecoder().decode(ChatResponse.self, from: data)
    }

    /// Stream a chat response using Server-Sent Events
    func streamMessage(_ content: String, conversationId: String? = nil) -> AsyncThrowingStream<StreamChunk, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var request = try makeRequest(endpoint: "/chat/unified", method: "POST")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                    let body = ChatRequest(
                        message: content,
                        conversationId: conversationId,
                        product: "wellsai",
                        stream: true
                    )
                    request.httpBody = try JSONEncoder().encode(body)

                    let (bytes, response) = try await session.bytes(for: request)
                    try validateResponse(response)

                    for try await line in bytes.lines {
                        if line.hasPrefix("data: ") {
                            let jsonString = String(line.dropFirst(6))
                            if jsonString == "[DONE]" {
                                continuation.finish()
                                return
                            }
                            if let data = jsonString.data(using: .utf8),
                               let chunk = try? JSONDecoder().decode(StreamChunk.self, from: data) {
                                continuation.yield(chunk)
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    /// Get conversation history
    func getConversation(id: String) async throws -> ConversationDetail {
        let request = try makeRequest(endpoint: "/chat/unified?conversationId=\(id)", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(ConversationDetail.self, from: data)
    }

    /// List all conversations
    func listConversations(limit: Int = 20, offset: Int = 0) async throws -> ConversationListResponse {
        let request = try makeRequest(endpoint: "/chat/unified/list?limit=\(limit)&offset=\(offset)", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(ConversationListResponse.self, from: data)
    }

    // MARK: - Auth API

    /// Verify Clerk token with backend
    func verifyToken(_ token: String) async throws -> AuthResponse {
        var request = try makeRequest(endpoint: "/auth/clerk/verify", method: "POST")
        let body = ["token": token]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }

    // MARK: - Helpers

    private func makeRequest(endpoint: String, method: String) throws -> URLRequest {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Add auth token if available
        if let token = AuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        case 429:
            throw APIError.rateLimited
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            throw APIError.httpError(httpResponse.statusCode)
        }
    }
}

// MARK: - API Models

struct ChatRequest: Encodable {
    let message: String
    let conversationId: String?
    let product: String
    var stream: Bool = false
}

struct ChatResponse: Decodable {
    let response: String
    let conversationId: String
    let messageId: String?
}

struct StreamChunk: Decodable {
    let content: String?
    let conversationId: String?
    let done: Bool?
}

struct ConversationDetail: Decodable {
    let id: String
    let messages: [MessageResponse]
    let createdAt: String
    let updatedAt: String
}

struct MessageResponse: Decodable {
    let id: String
    let role: String
    let content: String
    let createdAt: String
}

struct ConversationListResponse: Decodable {
    let conversations: [ConversationSummary]
    let total: Int
    let hasMore: Bool
}

struct ConversationSummary: Decodable, Identifiable {
    let id: String
    let title: String?
    let preview: String?
    let messageCount: Int
    let createdAt: String
    let updatedAt: String
}

struct AuthResponse: Decodable {
    let success: Bool
    let userId: String?
    let email: String?
}

// MARK: - Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case notFound
    case rateLimited
    case serverError(Int)
    case httpError(Int)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Please sign in to continue"
        case .notFound:
            return "Resource not found"
        case .rateLimited:
            return "Too many requests. Please wait a moment."
        case .serverError(let code):
            return "Server error (\(code))"
        case .httpError(let code):
            return "HTTP error (\(code))"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        }
    }
}

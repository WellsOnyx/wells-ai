import Foundation

/// API client for Grain & Vault backend
actor GrainVaultAPIClient {
    static let shared = GrainVaultAPIClient()

    private let baseURL = "https://grainandvault.com/api"
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    // MARK: - Treasury API

    /// Get GRAIN balance and treasury stats
    func getBalance() async throws -> TreasuryBalance {
        let request = try makeRequest(endpoint: "/grain-vault/balance", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(TreasuryBalance.self, from: data)
    }

    /// Get current GRAIN price and appreciation rate
    func getGrainPrice() async throws -> GrainPrice {
        let request = try makeRequest(endpoint: "/treasury/grain-price", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(GrainPrice.self, from: data)
    }

    /// Get transaction history
    func getTransactions(limit: Int = 50, offset: Int = 0) async throws -> TransactionListResponse {
        let request = try makeRequest(endpoint: "/grain-vault/payments/history?limit=\(limit)&offset=\(offset)", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(TransactionListResponse.self, from: data)
    }

    // MARK: - Payments API

    /// Send a payment
    func sendPayment(to recipient: String, amount: Decimal, note: String?) async throws -> PaymentResponse {
        var request = try makeRequest(endpoint: "/grain-vault/payments", method: "POST")

        let body = SendPaymentRequest(
            recipient: recipient,
            amount: amount,
            currency: "GRAIN",
            note: note
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(PaymentResponse.self, from: data)
    }

    /// Look up recipient by email or phone
    func lookupRecipient(query: String) async throws -> [RecipientLookup] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let request = try makeRequest(endpoint: "/grain-vault/recipients/lookup?q=\(encoded)", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode([RecipientLookup].self, from: data)
    }

    /// Request a payment from someone
    func requestPayment(from: String, amount: Decimal, note: String?) async throws -> PaymentRequestResponse {
        var request = try makeRequest(endpoint: "/grain-vault/payments/request", method: "POST")

        let body = RequestPaymentRequest(
            from: from,
            amount: amount,
            currency: "GRAIN",
            note: note
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(PaymentRequestResponse.self, from: data)
    }

    // MARK: - Credit Line API

    /// Get credit line status
    func getCreditLine() async throws -> CreditLineStatus {
        let request = try makeRequest(endpoint: "/grain-vault/credit-line", method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(CreditLineStatus.self, from: data)
    }

    /// Draw from credit line
    func drawCredit(amount: Decimal) async throws -> CreditDrawResponse {
        var request = try makeRequest(endpoint: "/grain-vault/credit/draw", method: "POST")

        let body = ["amount": amount]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(CreditDrawResponse.self, from: data)
    }

    /// Repay credit line
    func repayCredit(amount: Decimal) async throws -> CreditRepayResponse {
        var request = try makeRequest(endpoint: "/grain-vault/credit/repay", method: "POST")

        let body = ["amount": amount]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(CreditRepayResponse.self, from: data)
    }

    // MARK: - Auth API

    func verifyToken(_ token: String) async throws -> GVAuthResponse {
        var request = try makeRequest(endpoint: "/auth/clerk/verify", method: "POST")
        let body = ["token": token]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder().decode(GVAuthResponse.self, from: data)
    }

    // MARK: - Helpers

    private func makeRequest(endpoint: String, method: String) throws -> URLRequest {
        guard let url = URL(string: baseURL + endpoint) else {
            throw GVAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = GVAuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GVAPIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw GVAPIError.unauthorized
        case 404:
            throw GVAPIError.notFound
        case 429:
            throw GVAPIError.rateLimited
        case 500...599:
            throw GVAPIError.serverError(httpResponse.statusCode)
        default:
            throw GVAPIError.httpError(httpResponse.statusCode)
        }
    }
}

// MARK: - API Models

struct TreasuryBalance: Decodable {
    let grainBalance: Decimal
    let usdEquivalent: Decimal
    let appreciationRate: Double
    let lastUpdated: String
    let creditAvailable: Decimal?
}

// Type alias for widgets and App Intents
extension GrainVaultAPIClient {
    typealias BalanceResponse = TreasuryBalance
    typealias CreditLineResponse = CreditLineStatus
}

struct GrainPrice: Decodable {
    let price: Decimal
    let change24h: Double
    let marketCap: Decimal?
}

struct TransactionListResponse: Decodable {
    let transactions: [TransactionDetail]
    let total: Int
    let hasMore: Bool
}

struct TransactionDetail: Decodable, Identifiable {
    let id: String
    let type: String
    let amount: Decimal
    let currency: String
    let recipient: String?
    let sender: String?
    let note: String?
    let status: String
    let createdAt: String
}

struct SendPaymentRequest: Encodable {
    let recipient: String
    let amount: Decimal
    let currency: String
    let note: String?
}

struct PaymentResponse: Decodable {
    let success: Bool
    let transactionId: String
    let amount: Decimal
    let fee: Decimal?
}

struct RequestPaymentRequest: Encodable {
    let from: String
    let amount: Decimal
    let currency: String
    let note: String?
}

struct PaymentRequestResponse: Decodable {
    let success: Bool
    let requestId: String
    let amount: Decimal
    let status: String
}

struct RecipientLookup: Decodable, Identifiable {
    let id: String
    let displayName: String
    let identifier: String
    let type: String
}

struct CreditLineStatus: Decodable {
    let approved: Bool
    let limit: Decimal
    let used: Decimal
    let available: Decimal
    let apr: Double
    let nextPaymentDue: String?
    let minimumPayment: Decimal?
}

struct CreditDrawResponse: Decodable {
    let success: Bool
    let amount: Decimal
    let newBalance: Decimal
    let transactionId: String
}

struct CreditRepayResponse: Decodable {
    let success: Bool
    let amount: Decimal
    let remainingBalance: Decimal
    let transactionId: String
}

struct GVAuthResponse: Decodable {
    let success: Bool
    let userId: String?
    let email: String?
}

// MARK: - Errors

enum GVAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case notFound
    case rateLimited
    case serverError(Int)
    case httpError(Int)
    case insufficientFunds
    case creditLimitExceeded

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
            return "Too many requests. Please wait."
        case .serverError(let code):
            return "Server error (\(code))"
        case .httpError(let code):
            return "HTTP error (\(code))"
        case .insufficientFunds:
            return "Insufficient funds for this transaction"
        case .creditLimitExceeded:
            return "Credit limit would be exceeded"
        }
    }
}

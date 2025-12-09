import Foundation
import Security

/// Manages authentication state and Clerk token handling
@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var error: AuthError?

    private(set) var accessToken: String?

    private let keychainService = "io.wellsonyx.WellsAI"
    private let tokenKey = "accessToken"
    private let userKey = "currentUser"

    private init() {
        // Attempt to restore session on init
        restoreSession()
    }

    // MARK: - Public Methods

    /// Sign in with email and password (for demo/development)
    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil

        do {
            // For now, this is a simplified auth flow
            // In production, this would integrate with Clerk SDK
            let token = try await authenticateWithClerk(email: email, password: password)
            try saveToken(token)
            accessToken = token

            // Verify token with backend
            let authResponse = try await WellsAPIClient.shared.verifyToken(token)

            if authResponse.success {
                currentUser = User(
                    id: authResponse.userId ?? UUID().uuidString,
                    email: email,
                    firstName: nil,
                    lastName: nil,
                    imageURL: nil,
                    createdAt: Date()
                )
                try saveUser(currentUser!)
                isAuthenticated = true
            } else {
                throw AuthError.verificationFailed
            }
        } catch {
            self.error = error as? AuthError ?? .unknown(error.localizedDescription)
        }

        isLoading = false
    }

    /// Sign in with Apple
    func signInWithApple(identityToken: Data, authorizationCode: Data) async {
        isLoading = true
        error = nil

        do {
            // Convert identity token to string for verification
            guard let tokenString = String(data: identityToken, encoding: .utf8) else {
                throw AuthError.invalidToken
            }

            // Verify with backend (which will verify with Apple and create/get Clerk user)
            let authResponse = try await WellsAPIClient.shared.verifyToken(tokenString)

            if authResponse.success, let userId = authResponse.userId {
                // Get or create access token from Clerk
                accessToken = tokenString
                try saveToken(tokenString)

                currentUser = User(
                    id: userId,
                    email: authResponse.email,
                    firstName: nil,
                    lastName: nil,
                    imageURL: nil,
                    createdAt: Date()
                )
                if let user = currentUser {
                    try saveUser(user)
                }
                isAuthenticated = true
            } else {
                throw AuthError.verificationFailed
            }
        } catch {
            self.error = error as? AuthError ?? .unknown(error.localizedDescription)
        }

        isLoading = false
    }

    /// Sign out and clear all stored credentials
    func signOut() {
        accessToken = nil
        currentUser = nil
        isAuthenticated = false
        deleteToken()
        deleteUser()
    }

    /// Restore session from keychain
    func restoreSession() {
        if let token = loadToken(), let user = loadUser() {
            accessToken = token
            currentUser = user
            isAuthenticated = true

            // Optionally verify token is still valid
            Task {
                await verifyStoredToken()
            }
        }
    }

    // MARK: - Private Methods

    private func authenticateWithClerk(email: String, password: String) async throws -> String {
        // Simplified mock authentication for development
        // In production, use Clerk iOS SDK
        try await Task.sleep(nanoseconds: 500_000_000) // Simulate network delay

        // For demo purposes, accept any email/password
        // Real implementation would call Clerk's signIn endpoint
        return "demo_token_\(UUID().uuidString)"
    }

    private func verifyStoredToken() async {
        guard let token = accessToken else { return }

        do {
            let response = try await WellsAPIClient.shared.verifyToken(token)
            if !response.success {
                await MainActor.run {
                    signOut()
                }
            }
        } catch {
            // Token verification failed - sign out
            await MainActor.run {
                signOut()
            }
        }
    }

    // MARK: - Keychain Operations

    private func saveToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw AuthError.keychainError
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary) // Remove existing
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw AuthError.keychainError
        }
    }

    private func loadToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }

        return token
    }

    private func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: tokenKey
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func saveUser(_ user: User) throws {
        let data = try JSONEncoder().encode(user)
        UserDefaults.standard.set(data, forKey: userKey)
    }

    private func loadUser() -> User? {
        guard let data = UserDefaults.standard.data(forKey: userKey) else {
            return nil
        }
        return try? JSONDecoder().decode(User.self, from: data)
    }

    private func deleteUser() {
        UserDefaults.standard.removeObject(forKey: userKey)
    }
}

// MARK: - Errors

enum AuthError: LocalizedError {
    case invalidCredentials
    case invalidToken
    case verificationFailed
    case keychainError
    case networkError
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid email or password"
        case .invalidToken:
            return "Invalid authentication token"
        case .verificationFailed:
            return "Failed to verify authentication"
        case .keychainError:
            return "Failed to save credentials securely"
        case .networkError:
            return "Network error. Please try again."
        case .unknown(let message):
            return message
        }
    }
}

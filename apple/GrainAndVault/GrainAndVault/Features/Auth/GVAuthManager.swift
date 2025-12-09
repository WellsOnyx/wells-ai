import Foundation
import Security

/// Authentication manager for Grain & Vault
@MainActor
final class GVAuthManager: ObservableObject {
    static let shared = GVAuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: GVUser?
    @Published var isLoading = false
    @Published var error: GVAuthError?

    private(set) var accessToken: String?

    private let keychainService = "com.grainandvault.app"
    private let tokenKey = "accessToken"
    private let userKey = "currentUser"

    private init() {
        restoreSession()
    }

    // MARK: - Public Methods

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil

        do {
            // Simplified auth for development
            let token = try await authenticateWithClerk(email: email, password: password)
            try saveToken(token)
            accessToken = token

            let authResponse = try await GrainVaultAPIClient.shared.verifyToken(token)

            if authResponse.success {
                currentUser = GVUser(
                    id: authResponse.userId ?? UUID().uuidString,
                    email: email
                )
                try saveUser(currentUser!)
                isAuthenticated = true
            } else {
                throw GVAuthError.verificationFailed
            }
        } catch {
            self.error = error as? GVAuthError ?? .unknown(error.localizedDescription)
        }

        isLoading = false
    }

    func signInWithApple(identityToken: Data, authorizationCode: Data) async {
        isLoading = true
        error = nil

        do {
            guard let tokenString = String(data: identityToken, encoding: .utf8) else {
                throw GVAuthError.invalidToken
            }

            let authResponse = try await GrainVaultAPIClient.shared.verifyToken(tokenString)

            if authResponse.success, let userId = authResponse.userId {
                accessToken = tokenString
                try saveToken(tokenString)

                currentUser = GVUser(
                    id: userId,
                    email: authResponse.email
                )
                if let user = currentUser {
                    try saveUser(user)
                }
                isAuthenticated = true
            } else {
                throw GVAuthError.verificationFailed
            }
        } catch {
            self.error = error as? GVAuthError ?? .unknown(error.localizedDescription)
        }

        isLoading = false
    }

    func signOut() {
        accessToken = nil
        currentUser = nil
        isAuthenticated = false
        deleteToken()
        deleteUser()
    }

    func restoreSession() {
        if let token = loadToken(), let user = loadUser() {
            accessToken = token
            currentUser = user
            isAuthenticated = true
        }
    }

    // MARK: - Private Methods

    private func authenticateWithClerk(email: String, password: String) async throws -> String {
        try await Task.sleep(nanoseconds: 500_000_000)
        return "gv_token_\(UUID().uuidString)"
    }

    // MARK: - Keychain Operations

    private func saveToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw GVAuthError.keychainError
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            throw GVAuthError.keychainError
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

    private func saveUser(_ user: GVUser) throws {
        let data = try JSONEncoder().encode(user)
        UserDefaults.standard.set(data, forKey: userKey)
    }

    private func loadUser() -> GVUser? {
        guard let data = UserDefaults.standard.data(forKey: userKey) else {
            return nil
        }
        return try? JSONDecoder().decode(GVUser.self, from: data)
    }

    private func deleteUser() {
        UserDefaults.standard.removeObject(forKey: userKey)
    }
}

struct GVUser: Codable, Identifiable {
    let id: String
    let email: String?

    var displayName: String {
        email?.components(separatedBy: "@").first ?? "User"
    }
}

enum GVAuthError: LocalizedError {
    case invalidCredentials
    case invalidToken
    case verificationFailed
    case keychainError
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
            return "Failed to save credentials"
        case .unknown(let message):
            return message
        }
    }
}

import SwiftUI
import AuthenticationServices

struct GVAuthView: View {
    @EnvironmentObject var authManager: GVAuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 32) {
                    Spacer()
                        .frame(height: geometry.size.height * 0.1)

                    // Logo and Title
                    VStack(spacing: 16) {
                        Image(systemName: "building.columns.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(.green.gradient)

                        Text("Grain & Vault")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Text("Treasury Management & Payments")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    // Auth Form
                    VStack(spacing: 16) {
                        TextField("Email", text: $email)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.emailAddress)
                            .autocapitalization(.none)
                            .keyboardType(.emailAddress)

                        SecureField("Password", text: $password)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(isSignUp ? .newPassword : .password)

                        if let error = authManager.error {
                            Text(error.localizedDescription)
                                .font(.caption)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }

                        Button(action: signIn) {
                            if authManager.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text(isSignUp ? "Create Account" : "Sign In")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .controlSize(.large)
                        .disabled(email.isEmpty || password.isEmpty || authManager.isLoading)

                        Button(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up") {
                            withAnimation {
                                isSignUp.toggle()
                            }
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 32)

                    // Divider
                    HStack {
                        Rectangle()
                            .fill(Color.secondary.opacity(0.3))
                            .frame(height: 1)
                        Text("or")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Rectangle()
                            .fill(Color.secondary.opacity(0.3))
                            .frame(height: 1)
                    }
                    .padding(.horizontal, 32)

                    // Sign in with Apple
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        handleAppleSignIn(result)
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 50)
                    .padding(.horizontal, 32)

                    Spacer()
                }
            }
        }
        .background(Color(.systemBackground))
    }

    private func signIn() {
        Task {
            await authManager.signIn(email: email, password: password)
        }
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let auth):
            if let credential = auth.credential as? ASAuthorizationAppleIDCredential,
               let identityToken = credential.identityToken,
               let authorizationCode = credential.authorizationCode {
                Task {
                    await authManager.signInWithApple(
                        identityToken: identityToken,
                        authorizationCode: authorizationCode
                    )
                }
            }
        case .failure(let error):
            print("Apple Sign In failed: \(error.localizedDescription)")
        }
    }
}

#Preview {
    GVAuthView()
        .environmentObject(GVAuthManager.shared)
}

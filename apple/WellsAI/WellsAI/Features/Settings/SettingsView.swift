import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @AppStorage("hapticFeedback") private var hapticFeedback = true
    @AppStorage("streamResponses") private var streamResponses = true

    @State private var showingSignOutAlert = false

    var body: some View {
        NavigationStack {
            List {
                // Account Section
                Section("Account") {
                    if let user = authManager.currentUser {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(Color.blue.gradient)
                                .frame(width: 50, height: 50)
                                .overlay {
                                    Text(user.initials)
                                        .font(.headline)
                                        .foregroundColor(.white)
                                }

                            VStack(alignment: .leading) {
                                Text(user.displayName)
                                    .font(.headline)

                                if let email = user.email {
                                    Text(email)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Button("Sign Out", role: .destructive) {
                        showingSignOutAlert = true
                    }
                }

                // Chat Settings
                Section("Chat") {
                    Toggle("Stream Responses", isOn: $streamResponses)

                    #if os(iOS)
                    Toggle("Haptic Feedback", isOn: $hapticFeedback)
                    #endif
                }

                // About Section
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                            .foregroundColor(.secondary)
                    }

                    Link(destination: URL(string: "https://wellsonyx.io")!) {
                        HStack {
                            Text("Website")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(.secondary)
                        }
                    }

                    Link(destination: URL(string: "https://wellsonyx.io/privacy")!) {
                        HStack {
                            Text("Privacy Policy")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(.secondary)
                        }
                    }

                    Link(destination: URL(string: "https://wellsonyx.io/terms")!) {
                        HStack {
                            Text("Terms of Service")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Debug Section (only in debug builds)
                #if DEBUG
                Section("Debug") {
                    Button("Clear Local Data") {
                        // Clear UserDefaults
                        if let bundleID = Bundle.main.bundleIdentifier {
                            UserDefaults.standard.removePersistentDomain(forName: bundleID)
                        }
                    }
                }
                #endif
            }
            .navigationTitle("Settings")
            .alert("Sign Out", isPresented: $showingSignOutAlert) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) {
                    authManager.signOut()
                }
            } message: {
                Text("Are you sure you want to sign out?")
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthManager.shared)
}

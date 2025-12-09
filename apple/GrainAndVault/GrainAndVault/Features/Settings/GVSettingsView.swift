import SwiftUI

struct GVSettingsView: View {
    @EnvironmentObject var authManager: GVAuthManager
    @AppStorage("biometricAuth") private var biometricAuth = true
    @AppStorage("notifications") private var notifications = true
    @State private var showingSignOutAlert = false

    var body: some View {
        NavigationStack {
            List {
                // Account
                Section("Account") {
                    if let user = authManager.currentUser {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(Color.green.gradient)
                                .frame(width: 50, height: 50)
                                .overlay {
                                    Image(systemName: "building.columns.fill")
                                        .font(.title3)
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

                    NavigationLink(destination: AccountDetailsView()) {
                        Label("Account Details", systemImage: "person.circle")
                    }

                    NavigationLink(destination: LinkedAccountsView()) {
                        Label("Linked Accounts", systemImage: "link")
                    }
                }

                // Security
                Section("Security") {
                    Toggle(isOn: $biometricAuth) {
                        Label("Face ID / Touch ID", systemImage: "faceid")
                    }

                    NavigationLink(destination: SecuritySettingsView()) {
                        Label("Security Settings", systemImage: "lock.shield")
                    }
                }

                // Notifications
                Section("Notifications") {
                    Toggle(isOn: $notifications) {
                        Label("Push Notifications", systemImage: "bell")
                    }

                    NavigationLink(destination: NotificationPreferencesView()) {
                        Label("Notification Preferences", systemImage: "bell.badge")
                    }
                }

                // Credit Line
                Section("Credit Line") {
                    NavigationLink(destination: CreditSettingsView()) {
                        Label("Credit Settings", systemImage: "creditcard")
                    }

                    NavigationLink(destination: AutoPayView()) {
                        Label("Auto-Pay", systemImage: "arrow.clockwise.circle")
                    }
                }

                // Support
                Section("Support") {
                    Link(destination: URL(string: "https://grainandvault.com/help")!) {
                        HStack {
                            Label("Help Center", systemImage: "questionmark.circle")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(.secondary)
                        }
                    }

                    Link(destination: URL(string: "mailto:support@grainandvault.com")!) {
                        HStack {
                            Label("Contact Support", systemImage: "envelope")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Legal
                Section("Legal") {
                    Link(destination: URL(string: "https://grainandvault.com/privacy")!) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }

                    Link(destination: URL(string: "https://grainandvault.com/terms")!) {
                        Label("Terms of Service", systemImage: "doc.text")
                    }
                }

                // About
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                            .foregroundColor(.secondary)
                    }
                }

                // Sign Out
                Section {
                    Button("Sign Out", role: .destructive) {
                        showingSignOutAlert = true
                    }
                }
            }
            .navigationTitle("Settings")
            .alert("Sign Out", isPresented: $showingSignOutAlert) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) {
                    authManager.signOut()
                }
            } message: {
                Text("Are you sure you want to sign out of Grain & Vault?")
            }
        }
    }
}

// Placeholder views
struct AccountDetailsView: View {
    var body: some View {
        Text("Account Details")
            .navigationTitle("Account")
    }
}

struct LinkedAccountsView: View {
    var body: some View {
        Text("Linked Accounts")
            .navigationTitle("Linked Accounts")
    }
}

struct SecuritySettingsView: View {
    var body: some View {
        Text("Security Settings")
            .navigationTitle("Security")
    }
}

struct NotificationPreferencesView: View {
    var body: some View {
        Text("Notification Preferences")
            .navigationTitle("Notifications")
    }
}

struct CreditSettingsView: View {
    var body: some View {
        Text("Credit Settings")
            .navigationTitle("Credit")
    }
}

struct AutoPayView: View {
    var body: some View {
        Text("Auto-Pay Settings")
            .navigationTitle("Auto-Pay")
    }
}

#Preview {
    GVSettingsView()
        .environmentObject(GVAuthManager.shared)
}

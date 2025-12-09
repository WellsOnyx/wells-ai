import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: GVAuthManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                MainTabView()
            } else {
                GVAuthView()
            }
        }
        .animation(.easeInOut, value: authManager.isAuthenticated)
    }
}

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        #if os(iOS)
        TabView(selection: $selectedTab) {
            TreasuryDashboard()
                .tabItem {
                    Label("Treasury", systemImage: "banknote")
                }
                .tag(0)

            PaymentsView()
                .tabItem {
                    Label("Pay", systemImage: "arrow.left.arrow.right")
                }
                .tag(1)

            CreditLineView()
                .tabItem {
                    Label("Credit", systemImage: "creditcard")
                }
                .tag(2)

            GVSettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(3)
        }
        #else
        NavigationSplitView {
            List(selection: $selectedTab) {
                NavigationLink(value: 0) {
                    Label("Treasury", systemImage: "banknote")
                }
                NavigationLink(value: 1) {
                    Label("Payments", systemImage: "arrow.left.arrow.right")
                }
                NavigationLink(value: 2) {
                    Label("Credit Line", systemImage: "creditcard")
                }
                NavigationLink(value: 3) {
                    Label("Settings", systemImage: "gear")
                }
            }
            .navigationTitle("Grain & Vault")
        } detail: {
            switch selectedTab {
            case 0:
                TreasuryDashboard()
            case 1:
                PaymentsView()
            case 2:
                CreditLineView()
            case 3:
                GVSettingsView()
            default:
                TreasuryDashboard()
            }
        }
        #endif
    }
}

#if os(macOS)
struct MenuBarView: View {
    @EnvironmentObject var authManager: GVAuthManager
    @StateObject private var viewModel = TreasuryViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if authManager.isAuthenticated {
                // Balance display
                VStack(alignment: .leading, spacing: 4) {
                    Text("GRAIN Balance")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(viewModel.grainBalance.formatted(.currency(code: "USD")))
                        .font(.title2)
                        .fontWeight(.bold)
                }

                Divider()

                // Quick actions
                Button("Send Payment") {
                    NSWorkspace.shared.open(URL(string: "grainvault://pay")!)
                }

                Button("Check Credit") {
                    NSWorkspace.shared.open(URL(string: "grainvault://credit")!)
                }

                Divider()

                Button("Open Grain & Vault") {
                    NSWorkspace.shared.open(URL(string: "grainvault://")!)
                }
            } else {
                Text("Sign in to view balance")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Button("Sign In") {
                    NSWorkspace.shared.open(URL(string: "grainvault://auth")!)
                }
            }

            Divider()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }
        .padding()
        .frame(width: 200)
    }
}
#endif

#Preview {
    ContentView()
        .environmentObject(GVAuthManager.shared)
}

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                MainTabView()
            } else {
                AuthView()
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
            ChatView()
                .tabItem {
                    Label("Chat", systemImage: "bubble.left.and.bubble.right")
                }
                .tag(0)

            ConversationListView()
                .tabItem {
                    Label("History", systemImage: "clock")
                }
                .tag(1)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
        #else
        NavigationSplitView {
            List(selection: $selectedTab) {
                NavigationLink(value: 0) {
                    Label("Chat", systemImage: "bubble.left.and.bubble.right")
                }
                NavigationLink(value: 1) {
                    Label("History", systemImage: "clock")
                }
                NavigationLink(value: 2) {
                    Label("Settings", systemImage: "gear")
                }
            }
            .navigationTitle("WellsAI")
        } detail: {
            switch selectedTab {
            case 0:
                ChatView()
            case 1:
                ConversationListView()
            case 2:
                SettingsView()
            default:
                ChatView()
            }
        }
        #endif
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager.shared)
}

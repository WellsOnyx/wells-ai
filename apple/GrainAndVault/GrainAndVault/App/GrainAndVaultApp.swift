import SwiftUI
import SwiftData

@main
struct GrainAndVaultApp: App {
    @StateObject private var authManager = GVAuthManager.shared

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Transaction.self,
            CachedBalance.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
        }
        .modelContainer(sharedModelContainer)

        #if os(macOS)
        MenuBarExtra("Grain & Vault", systemImage: "dollarsign.circle.fill") {
            MenuBarView()
                .environmentObject(authManager)
        }
        .menuBarExtraStyle(.window)

        Settings {
            GVSettingsView()
                .environmentObject(authManager)
        }
        #endif
    }
}

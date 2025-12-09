import AppIntents

// MARK: - App Shortcuts Provider

struct GrainVaultShortcuts: AppShortcutsProvider {

    /// App shortcuts for Spotlight and Shortcuts app
    /// Note: NO Siri phrases - empty array per user request
    static var appShortcuts: [AppShortcut] {

        // Check Balance
        AppShortcut(
            intent: CheckBalanceIntent(),
            phrases: [], // Empty - no Siri integration
            shortTitle: "Check Balance",
            systemImageName: "dollarsign.circle"
        )

        // Check Credit Line
        AppShortcut(
            intent: CheckCreditIntent(),
            phrases: [], // Empty - no Siri integration
            shortTitle: "Check Credit",
            systemImageName: "creditcard"
        )

        // Send Payment
        AppShortcut(
            intent: SendPaymentIntent(),
            phrases: [], // Empty - no Siri integration
            shortTitle: "Send Payment",
            systemImageName: "arrow.up.circle"
        )

        // Request Payment
        AppShortcut(
            intent: RequestPaymentIntent(),
            phrases: [], // Empty - no Siri integration
            shortTitle: "Request Payment",
            systemImageName: "arrow.down.circle"
        )

        // Recent Payments
        AppShortcut(
            intent: RecentPaymentsIntent(),
            phrases: [], // Empty - no Siri integration
            shortTitle: "Recent Payments",
            systemImageName: "clock.arrow.circlepath"
        )

        // Draw Funds
        AppShortcut(
            intent: QuickDrawIntent(),
            phrases: [], // Empty - no Siri integration
            shortTitle: "Draw Funds",
            systemImageName: "plus.circle"
        )
    }
}

// MARK: - Spotlight Indexing

import CoreSpotlight

extension GrainVaultShortcuts {

    /// Index app content for Spotlight search
    static func indexForSpotlight() {
        let searchableItems: [CSSearchableItem] = [
            // Balance
            CSSearchableItem(
                uniqueIdentifier: "grainvault.balance",
                domainIdentifier: "com.grainvault.treasury",
                attributeSet: {
                    let attributes = CSSearchableItemAttributeSet(contentType: .content)
                    attributes.title = "Check GRAIN Balance"
                    attributes.contentDescription = "View your current GRAIN balance and credit line status"
                    attributes.keywords = ["balance", "grain", "treasury", "money", "wallet"]
                    return attributes
                }()
            ),

            // Payments
            CSSearchableItem(
                uniqueIdentifier: "grainvault.payments",
                domainIdentifier: "com.grainvault.payments",
                attributeSet: {
                    let attributes = CSSearchableItemAttributeSet(contentType: .content)
                    attributes.title = "Send Payment"
                    attributes.contentDescription = "Send money to anyone instantly"
                    attributes.keywords = ["payment", "send", "money", "transfer", "pay"]
                    return attributes
                }()
            ),

            // Credit
            CSSearchableItem(
                uniqueIdentifier: "grainvault.credit",
                domainIdentifier: "com.grainvault.credit",
                attributeSet: {
                    let attributes = CSSearchableItemAttributeSet(contentType: .content)
                    attributes.title = "Credit Line"
                    attributes.contentDescription = "Manage your credit line and draw funds"
                    attributes.keywords = ["credit", "loan", "draw", "funds", "borrow"]
                    return attributes
                }()
            ),
        ]

        CSSearchableIndex.default().indexSearchableItems(searchableItems) { error in
            if let error = error {
                print("Spotlight indexing error: \(error)")
            }
        }
    }
}

// MARK: - Deep Link Handling

enum GrainVaultDeepLink: String {
    case balance = "grainvault://balance"
    case payments = "grainvault://payments"
    case send = "grainvault://send"
    case request = "grainvault://request"
    case credit = "grainvault://credit"
    case draw = "grainvault://credit/draw"
    case settings = "grainvault://settings"

    var url: URL {
        URL(string: rawValue)!
    }
}

// MARK: - Intent Donation

extension GrainVaultShortcuts {

    /// Donate an intent to the system for better suggestions
    static func donateCheckBalance() {
        let intent = CheckBalanceIntent()
        intent.donate()
    }

    static func donateSendPayment(to recipient: String, amount: Double) {
        let intent = SendPaymentIntent()
        intent.recipient = recipient
        intent.amount = amount
        intent.donate()
    }

    static func donateRequestPayment(from sender: String, amount: Double) {
        let intent = RequestPaymentIntent()
        intent.from = sender
        intent.amount = amount
        intent.donate()
    }
}

// MARK: - Intent Extensions for Donation

extension AppIntent {
    func donate() {
        Task {
            do {
                try await self.donate()
            } catch {
                print("Intent donation failed: \(error)")
            }
        }
    }
}

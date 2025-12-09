import Foundation
import SwiftData
import Combine

@MainActor
final class TreasuryViewModel: ObservableObject {
    @Published var grainBalance: Decimal = 0
    @Published var usdEquivalent: Decimal = 0
    @Published var appreciationRate: Double = 4.5
    @Published var creditLimit: Decimal = 0
    @Published var creditUsed: Decimal = 0
    @Published var creditAPR: Double = 0
    @Published var recentTransactions: [Transaction] = []
    @Published var chartData: [ChartDataPoint] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var lastUpdated = Date()

    var creditAvailable: Decimal {
        max(0, creditLimit - creditUsed)
    }

    var creditUtilization: Double {
        guard creditLimit > 0 else { return 0 }
        return Double(truncating: (creditUsed / creditLimit) as NSNumber)
    }

    // MARK: - Data Loading

    func loadData() async {
        isLoading = true
        defer { isLoading = false }

        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadBalance() }
            group.addTask { await self.loadCreditLine() }
            group.addTask { await self.loadTransactions() }
            group.addTask { await self.loadChartData() }
        }

        lastUpdated = Date()
    }

    func refresh() async {
        await loadData()
    }

    private func loadBalance() async {
        do {
            let balance = try await GrainVaultAPIClient.shared.getBalance()
            grainBalance = balance.grainBalance
            usdEquivalent = balance.usdEquivalent
            appreciationRate = balance.appreciationRate
        } catch {
            self.error = error.localizedDescription
            // Use mock data for demo
            grainBalance = 12543.87
            usdEquivalent = 12543.87
            appreciationRate = 4.5
        }
    }

    private func loadCreditLine() async {
        do {
            let creditLine = try await GrainVaultAPIClient.shared.getCreditLine()
            creditLimit = creditLine.limit
            creditUsed = creditLine.used
            creditAPR = creditLine.apr
        } catch {
            // Use mock data for demo
            creditLimit = 50000
            creditUsed = 12500
            creditAPR = 8.5
        }
    }

    private func loadTransactions() async {
        do {
            let response = try await GrainVaultAPIClient.shared.getTransactions(limit: 10)
            recentTransactions = response.transactions.map { detail in
                Transaction(
                    serverId: detail.id,
                    type: TransactionType(rawValue: detail.type) ?? .sent,
                    amount: detail.amount,
                    currency: detail.currency,
                    recipientName: detail.recipient,
                    senderName: detail.sender,
                    note: detail.note,
                    status: TransactionStatus(rawValue: detail.status) ?? .completed,
                    createdAt: ISO8601DateFormatter().date(from: detail.createdAt) ?? Date()
                )
            }
        } catch {
            // Use mock data for demo
            recentTransactions = [
                Transaction(type: .received, amount: 1500, recipientName: "Supplier Payment", status: .completed, createdAt: Date().addingTimeInterval(-3600)),
                Transaction(type: .sent, amount: 500, recipientName: "John Doe", note: "Invoice payment", status: .completed, createdAt: Date().addingTimeInterval(-86400)),
                Transaction(type: .creditDraw, amount: 5000, status: .completed, createdAt: Date().addingTimeInterval(-172800)),
            ]
        }
    }

    private func loadChartData() async {
        // Generate mock chart data for 30 days
        let calendar = Calendar.current
        chartData = (0..<30).reversed().map { daysAgo in
            let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date())!
            let baseValue = 12000.0
            let variation = Double.random(in: -500...500)
            let trend = Double(30 - daysAgo) * 15 // Upward trend
            return ChartDataPoint(date: date, value: baseValue + variation + trend)
        }
    }
}

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
}

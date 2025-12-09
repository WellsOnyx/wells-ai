import SwiftUI

struct CreditLineView: View {
    @StateObject private var viewModel = CreditLineViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Credit Status Card
                    CreditStatusCard(viewModel: viewModel)

                    // Actions
                    HStack(spacing: 16) {
                        NavigationLink(destination: DrawFundsView()) {
                            ActionCard(
                                title: "Draw Funds",
                                subtitle: "Access your credit",
                                icon: "plus.circle.fill",
                                color: .green
                            )
                        }

                        NavigationLink(destination: RepaymentView()) {
                            ActionCard(
                                title: "Make Payment",
                                subtitle: "Pay down balance",
                                icon: "checkmark.circle.fill",
                                color: .blue
                            )
                        }
                    }

                    // Details
                    CreditDetailsSection(viewModel: viewModel)

                    // Activity
                    CreditActivitySection(transactions: viewModel.creditTransactions)
                }
                .padding()
            }
            .navigationTitle("Credit Line")
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.loadData()
            }
        }
    }
}

struct CreditStatusCard: View {
    @ObservedObject var viewModel: CreditLineViewModel

    var body: some View {
        VStack(spacing: 20) {
            // Available Credit
            VStack(spacing: 4) {
                Text("Available Credit")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Text(viewModel.available.formatted(.currency(code: "USD")))
                    .font(.system(size: 44, weight: .bold, design: .rounded))
            }

            // Utilization bar
            VStack(spacing: 8) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.gray.opacity(0.2))

                        RoundedRectangle(cornerRadius: 8)
                            .fill(utilizationColor.gradient)
                            .frame(width: geometry.size.width * viewModel.utilization)
                    }
                }
                .frame(height: 12)

                HStack {
                    Text("Used: \(viewModel.used.formatted(.currency(code: "USD")))")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text("Limit: \(viewModel.limit.formatted(.currency(code: "USD")))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // APR
            HStack {
                Image(systemName: "percent")
                    .foregroundColor(.purple)
                Text("\(viewModel.apr, specifier: "%.1f")% APR")
                    .font(.subheadline)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.purple.opacity(0.1))
            .cornerRadius(20)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }

    private var utilizationColor: Color {
        if viewModel.utilization < 0.3 {
            return .green
        } else if viewModel.utilization < 0.7 {
            return .yellow
        } else {
            return .red
        }
    }
}

struct ActionCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(color)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct CreditDetailsSection: View {
    @ObservedObject var viewModel: CreditLineViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Credit Details")
                .font(.headline)

            VStack(spacing: 0) {
                DetailRow(label: "Credit Limit", value: viewModel.limit.formatted(.currency(code: "USD")))
                Divider()
                DetailRow(label: "Current Balance", value: viewModel.used.formatted(.currency(code: "USD")))
                Divider()
                DetailRow(label: "Available Credit", value: viewModel.available.formatted(.currency(code: "USD")))
                Divider()
                DetailRow(label: "APR", value: "\(viewModel.apr, specifier: "%.2f")%")

                if let nextPayment = viewModel.nextPaymentDue {
                    Divider()
                    DetailRow(label: "Next Payment Due", value: nextPayment.formatted(.dateTime.month().day()))
                }

                if let minPayment = viewModel.minimumPayment, minPayment > 0 {
                    Divider()
                    DetailRow(label: "Minimum Payment", value: minPayment.formatted(.currency(code: "USD")))
                }
            }
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .padding()
    }
}

struct CreditActivitySection: View {
    let transactions: [Transaction]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)

            if transactions.isEmpty {
                Text("No credit activity yet")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
            } else {
                VStack(spacing: 0) {
                    ForEach(transactions) { transaction in
                        CreditTransactionRow(transaction: transaction)
                        if transaction.id != transactions.last?.id {
                            Divider()
                        }
                    }
                }
                .background(Color(.systemGray6))
                .cornerRadius(12)
            }
        }
    }
}

struct CreditTransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.type == .creditDraw ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .font(.title3)
                .foregroundColor(transaction.type == .creditDraw ? .green : .blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.type.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(transaction.createdAt.formatted(.dateTime.month().day().year()))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(transaction.type == .creditDraw ? "+\(transaction.displayAmount)" : "-\(transaction.displayAmount)")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(transaction.type == .creditDraw ? .green : .blue)
        }
        .padding()
    }
}

struct DrawFundsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var isProcessing = false

    var body: some View {
        Form {
            Section {
                HStack {
                    Text("$")
                        .font(.title)
                        .foregroundColor(.secondary)

                    TextField("0.00", text: $amount)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .keyboardType(.decimalPad)
                }
                .padding()
            }

            Section("Available to draw") {
                Text("$37,500.00")
                    .font(.title2)
                    .fontWeight(.semibold)
            }

            Section {
                Button(action: drawFunds) {
                    if isProcessing {
                        ProgressView()
                    } else {
                        Text("Draw Funds")
                    }
                }
                .frame(maxWidth: .infinity)
                .disabled(amount.isEmpty || isProcessing)
            }
        }
        .navigationTitle("Draw Funds")
    }

    private func drawFunds() {
        isProcessing = true
        // Simulate API call
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isProcessing = false
            dismiss()
        }
    }
}

struct RepaymentView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var isProcessing = false

    var body: some View {
        Form {
            Section {
                HStack {
                    Text("$")
                        .font(.title)
                        .foregroundColor(.secondary)

                    TextField("0.00", text: $amount)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .keyboardType(.decimalPad)
                }
                .padding()
            }

            Section("Current Balance") {
                Text("$12,500.00")
                    .font(.title2)
                    .fontWeight(.semibold)
            }

            Section {
                Button("Pay Minimum ($250.00)") {
                    amount = "250.00"
                }

                Button("Pay Full Balance") {
                    amount = "12500.00"
                }
            }

            Section {
                Button(action: makePayment) {
                    if isProcessing {
                        ProgressView()
                    } else {
                        Text("Make Payment")
                    }
                }
                .frame(maxWidth: .infinity)
                .disabled(amount.isEmpty || isProcessing)
            }
        }
        .navigationTitle("Make Payment")
    }

    private func makePayment() {
        isProcessing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isProcessing = false
            dismiss()
        }
    }
}

@MainActor
class CreditLineViewModel: ObservableObject {
    @Published var limit: Decimal = 50000
    @Published var used: Decimal = 12500
    @Published var apr: Double = 8.5
    @Published var nextPaymentDue: Date?
    @Published var minimumPayment: Decimal?
    @Published var creditTransactions: [Transaction] = []
    @Published var isLoading = false

    var available: Decimal { limit - used }
    var utilization: Double { Double(truncating: (used / limit) as NSNumber) }

    func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let status = try await GrainVaultAPIClient.shared.getCreditLine()
            limit = status.limit
            used = status.used
            apr = status.apr
            minimumPayment = status.minimumPayment

            if let dueString = status.nextPaymentDue {
                nextPaymentDue = ISO8601DateFormatter().date(from: dueString)
            }
        } catch {
            // Use mock data
            nextPaymentDue = Calendar.current.date(byAdding: .day, value: 15, to: Date())
            minimumPayment = 250
        }

        // Mock transactions
        creditTransactions = [
            Transaction(type: .creditDraw, amount: 5000, status: .completed, createdAt: Date().addingTimeInterval(-86400 * 5)),
            Transaction(type: .creditRepay, amount: 1000, status: .completed, createdAt: Date().addingTimeInterval(-86400 * 10)),
            Transaction(type: .creditDraw, amount: 8500, status: .completed, createdAt: Date().addingTimeInterval(-86400 * 20)),
        ]
    }

    func refresh() async {
        await loadData()
    }
}

#Preview {
    CreditLineView()
}

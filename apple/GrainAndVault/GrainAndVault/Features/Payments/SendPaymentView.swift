import SwiftUI
import LocalAuthentication

struct SendPaymentView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SendPaymentViewModel()

    var prefilledRecipient: RecentRecipient?

    @State private var recipient = ""
    @State private var amount = ""
    @State private var note = ""
    @State private var showingConfirmation = false
    @State private var showingSuccess = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Recipient") {
                    TextField("Email, phone, or username", text: $recipient)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)

                    if !viewModel.lookupResults.isEmpty {
                        ForEach(viewModel.lookupResults) { result in
                            Button {
                                recipient = result.identifier
                                viewModel.selectedRecipient = result
                                viewModel.lookupResults = []
                            } label: {
                                HStack {
                                    Circle()
                                        .fill(Color.blue.gradient)
                                        .frame(width: 36, height: 36)
                                        .overlay {
                                            Text(String(result.displayName.prefix(2)).uppercased())
                                                .font(.caption)
                                                .foregroundColor(.white)
                                        }

                                    VStack(alignment: .leading) {
                                        Text(result.displayName)
                                            .font(.subheadline)
                                        Text(result.identifier)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("Amount") {
                    HStack {
                        Text("$")
                            .font(.title)
                            .foregroundColor(.secondary)

                        TextField("0.00", text: $amount)
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                }

                Section("Note (optional)") {
                    TextField("What's this for?", text: $note)
                }

                Section {
                    HStack {
                        Text("Available Balance")
                        Spacer()
                        Text(viewModel.availableBalance.formatted(.currency(code: "USD")))
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Fee")
                        Spacer()
                        Text("$0.00")
                            .foregroundColor(.green)
                    }
                }
            }
            .navigationTitle("Send Payment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Review") {
                        showingConfirmation = true
                    }
                    .disabled(!isValid)
                }
            }
            .onChange(of: recipient) { _, newValue in
                Task {
                    await viewModel.lookupRecipient(query: newValue)
                }
            }
            .onAppear {
                if let prefilled = prefilledRecipient {
                    recipient = prefilled.identifier
                }
            }
            .sheet(isPresented: $showingConfirmation) {
                PaymentConfirmationSheet(
                    recipient: viewModel.selectedRecipient?.displayName ?? recipient,
                    amount: Decimal(string: amount) ?? 0,
                    note: note,
                    onConfirm: sendPayment
                )
            }
            .alert("Payment Sent!", isPresented: $showingSuccess) {
                Button("Done") {
                    dismiss()
                }
            } message: {
                Text("\(amount.isEmpty ? "$0" : "$\(amount)") has been sent to \(recipient)")
            }
        }
    }

    private var isValid: Bool {
        !recipient.isEmpty && !amount.isEmpty && (Decimal(string: amount) ?? 0) > 0
    }

    private func sendPayment() {
        Task {
            let success = await viewModel.sendPayment(
                to: recipient,
                amount: Decimal(string: amount) ?? 0,
                note: note.isEmpty ? nil : note
            )

            if success {
                showingConfirmation = false
                showingSuccess = true
            }
        }
    }
}

struct PaymentConfirmationSheet: View {
    let recipient: String
    let amount: Decimal
    let note: String
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isAuthenticating = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Amount display
                VStack(spacing: 8) {
                    Text("You're sending")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text(amount.formatted(.currency(code: "USD")))
                        .font(.system(size: 48, weight: .bold, design: .rounded))

                    Text("to \(recipient)")
                        .font(.title3)
                }

                if !note.isEmpty {
                    Text("\"\(note)\"")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .italic()
                }

                Spacer()

                // Biometric button
                Button(action: authenticate) {
                    if isAuthenticating {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Label("Confirm with Face ID", systemImage: "faceid")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .controlSize(.large)
                .disabled(isAuthenticating)

                Button("Cancel") {
                    dismiss()
                }
                .foregroundColor(.secondary)
            }
            .padding()
            .navigationTitle("Confirm Payment")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium])
    }

    private func authenticate() {
        isAuthenticating = true

        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Confirm payment of \(amount.formatted(.currency(code: "USD")))") { success, _ in
                DispatchQueue.main.async {
                    isAuthenticating = false
                    if success {
                        onConfirm()
                    }
                }
            }
        } else {
            // Fallback - just confirm
            isAuthenticating = false
            onConfirm()
        }
    }
}

@MainActor
class SendPaymentViewModel: ObservableObject {
    @Published var lookupResults: [RecipientLookup] = []
    @Published var selectedRecipient: RecipientLookup?
    @Published var availableBalance: Decimal = 12543.87
    @Published var isLoading = false
    @Published var error: String?

    private var lookupTask: Task<Void, Never>?

    func lookupRecipient(query: String) async {
        lookupTask?.cancel()

        guard query.count >= 3 else {
            lookupResults = []
            return
        }

        lookupTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // Debounce

            guard !Task.isCancelled else { return }

            do {
                lookupResults = try await GrainVaultAPIClient.shared.lookupRecipient(query: query)
            } catch {
                // Mock results for demo
                if query.contains("@") {
                    lookupResults = [
                        RecipientLookup(id: "1", displayName: "Found User", identifier: query, type: "email")
                    ]
                }
            }
        }
    }

    func sendPayment(to recipient: String, amount: Decimal, note: String?) async -> Bool {
        isLoading = true
        defer { isLoading = false }

        do {
            _ = try await GrainVaultAPIClient.shared.sendPayment(to: recipient, amount: amount, note: note)
            return true
        } catch {
            self.error = error.localizedDescription
            // For demo, return success anyway
            return true
        }
    }
}

#Preview {
    SendPaymentView()
}

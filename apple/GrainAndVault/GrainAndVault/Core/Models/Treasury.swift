import Foundation
import SwiftData

@Model
final class Transaction {
    @Attribute(.unique) var id: UUID
    var serverId: String?
    var type: TransactionType
    var amount: Decimal
    var currency: String
    var recipientName: String?
    var recipientId: String?
    var senderName: String?
    var senderId: String?
    var note: String?
    var status: TransactionStatus
    var createdAt: Date

    init(
        id: UUID = UUID(),
        serverId: String? = nil,
        type: TransactionType,
        amount: Decimal,
        currency: String = "GRAIN",
        recipientName: String? = nil,
        recipientId: String? = nil,
        senderName: String? = nil,
        senderId: String? = nil,
        note: String? = nil,
        status: TransactionStatus = .pending,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.serverId = serverId
        self.type = type
        self.amount = amount
        self.currency = currency
        self.recipientName = recipientName
        self.recipientId = recipientId
        self.senderName = senderName
        self.senderId = senderId
        self.note = note
        self.status = status
        self.createdAt = createdAt
    }

    var displayAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: amount as NSNumber) ?? "$0.00"
    }

    var isIncoming: Bool {
        type == .received || type == .creditDraw
    }
}

enum TransactionType: String, Codable {
    case sent
    case received
    case creditDraw
    case creditRepay
    case deposit
    case withdrawal

    var displayName: String {
        switch self {
        case .sent: return "Sent"
        case .received: return "Received"
        case .creditDraw: return "Credit Draw"
        case .creditRepay: return "Repayment"
        case .deposit: return "Deposit"
        case .withdrawal: return "Withdrawal"
        }
    }

    var icon: String {
        switch self {
        case .sent: return "arrow.up.circle"
        case .received: return "arrow.down.circle"
        case .creditDraw: return "creditcard"
        case .creditRepay: return "checkmark.circle"
        case .deposit: return "plus.circle"
        case .withdrawal: return "minus.circle"
        }
    }
}

enum TransactionStatus: String, Codable {
    case pending
    case completed
    case failed
    case cancelled

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .completed: return "Completed"
        case .failed: return "Failed"
        case .cancelled: return "Cancelled"
        }
    }

    var color: String {
        switch self {
        case .pending: return "orange"
        case .completed: return "green"
        case .failed: return "red"
        case .cancelled: return "gray"
        }
    }
}

@Model
final class CachedBalance {
    @Attribute(.unique) var id: String
    var grainBalance: Decimal
    var usdEquivalent: Decimal
    var appreciationRate: Double
    var creditLimit: Decimal?
    var creditUsed: Decimal?
    var lastUpdated: Date

    init(
        id: String = "current",
        grainBalance: Decimal = 0,
        usdEquivalent: Decimal = 0,
        appreciationRate: Double = 0,
        creditLimit: Decimal? = nil,
        creditUsed: Decimal? = nil,
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.grainBalance = grainBalance
        self.usdEquivalent = usdEquivalent
        self.appreciationRate = appreciationRate
        self.creditLimit = creditLimit
        self.creditUsed = creditUsed
        self.lastUpdated = lastUpdated
    }

    var creditAvailable: Decimal? {
        guard let limit = creditLimit, let used = creditUsed else { return nil }
        return limit - used
    }
}

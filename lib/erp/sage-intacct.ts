// Sage Intacct ERP Integration
// XML-based Web Services API with sender ID and password authentication
// CFO-favorite for multi-entity accounting - supports entity context

import { neon } from '@neondatabase/serverless';
import * as crypto from 'crypto';
import type { ERPConnection } from './types';

const _dbUrl = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
const sql = _dbUrl ? neon(_dbUrl) : null;

// Sage Intacct Web Services API endpoints
const INTACCT_ENDPOINT = 'https://api.intacct.com/ia/xml/xmlgw.phtml';
const INTACCT_API_VERSION = '3.0';
const INTACCT_DTD_VERSION = '3.0';

// Sage Intacct Record Structures
interface IntacctVendor {
  VENDORID: string;
  NAME: string;
  DISPLAYCONTACT?: {
    CONTACTNAME?: string;
    EMAIL1?: string;
    PHONE1?: string;
    MAILADDRESS?: {
      ADDRESS1?: string;
      ADDRESS2?: string;
      CITY?: string;
      STATE?: string;
      ZIP?: string;
      COUNTRY?: string;
    };
  };
  STATUS: 'active' | 'inactive';
  TAXID?: string;
  CURRENCY?: string;
  TERMNAME?: string;
  PAYMETHOD?: string;
  BANKACCOUNTNO?: string;
  BANKROUTINGNO?: string;
  WHENMODIFIED?: string;
}

interface IntacctBill {
  RECORDNO: string;
  RECORDID: string;
  VENDORID: string;
  VENDORNAME?: string;
  WHENCREATED: string;
  WHENDUE: string;
  TOTALAMOUNT: number;
  TOTALDUE: number;
  TOTALPAID: number;
  CURRENCY?: string;
  STATE: 'Posted' | 'Draft' | 'Submitted' | 'Approved' | 'Declined' | 'Partially Approved';
  DESCRIPTION?: string;
  LOCATIONID?: string;
  DEPARTMENTID?: string;
  PROJECTID?: string;
  APBILLITEMS?: Array<{
    ACCOUNTNO: string;
    AMOUNT: number;
    MEMO?: string;
    LOCATIONID?: string;
    DEPARTMENTID?: string;
  }>;
}

interface IntacctPayment {
  RECORDNO: string;
  PAYMENTMETHOD: string;
  VENDORID: string;
  VENDORNAME?: string;
  PAYMENTDATE: string;
  PAYMENTAMOUNT: number;
  CURRENCY?: string;
  DOCNUMBER?: string;
  BANKACCOUNTID?: string;
  DESCRIPTION?: string;
  STATE: string;
  LOCATIONID?: string;
}

interface IntacctEntity {
  LOCATIONID: string;
  NAME: string;
  PARENTID?: string;
  STATUS: 'active' | 'inactive';
  CURRENCY?: string;
  STARTDATE?: string;
  ENDDATE?: string;
}

interface IntacctSession {
  sessionId: string;
  endpoint: string;
  expiresAt: Date;
}

export class SageIntacctService {
  private senderId: string;
  private senderPassword: string;
  private defaultEntityId: string | null;

  constructor() {
    this.senderId = process.env.SAGE_INTACCT_SENDER_ID || '';
    this.senderPassword = process.env.SAGE_INTACCT_SENDER_PASSWORD || '';
    this.defaultEntityId = process.env.SAGE_INTACCT_DEFAULT_ENTITY_ID || null;

    if (!this.senderId || !this.senderPassword) {
      console.warn('Sage Intacct credentials not configured - integration disabled');
    }
  }

  // ============================================================================
  // XML REQUEST BUILDERS
  // ============================================================================

  private buildAuthenticationXML(companyId: string, userId: string, userPassword: string): string {
    return `
      <authentication>
        <login>
          <userid>${this.escapeXML(userId)}</userid>
          <companyid>${this.escapeXML(companyId)}</companyid>
          <password>${this.escapeXML(userPassword)}</password>
          ${this.defaultEntityId ? `<locationid>${this.escapeXML(this.defaultEntityId)}</locationid>` : ''}
        </login>
      </authentication>
    `;
  }

  private buildSessionAuthXML(sessionId: string): string {
    return `
      <authentication>
        <sessionid>${this.escapeXML(sessionId)}</sessionid>
      </authentication>
    `;
  }

  private buildControlBlock(controlId: string): string {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    return `
      <control>
        <senderid>${this.escapeXML(this.senderId)}</senderid>
        <password>${this.escapeXML(this.senderPassword)}</password>
        <controlid>${this.escapeXML(controlId)}</controlid>
        <uniqueid>false</uniqueid>
        <dtdversion>${INTACCT_DTD_VERSION}</dtdversion>
        <includewhitespace>false</includewhitespace>
      </control>
    `;
  }

  private buildRequest(
    authentication: string,
    functions: string,
    controlId?: string
  ): string {
    const uniqueControlId = controlId || `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  ${this.buildControlBlock(uniqueControlId)}
  <operation>
    ${authentication}
    <content>
      ${functions}
    </content>
  </operation>
</request>`;
  }

  private escapeXML(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================================================
  // XML RESPONSE PARSERS
  // ============================================================================

  private parseXMLResponse(xmlString: string): any {
    // Simple XML parser for Sage Intacct responses
    // In production, use a proper XML parser like fast-xml-parser
    const result: any = {};

    // Check for error response
    const errorMatch = xmlString.match(/<error>[\s\S]*?<errorno>([^<]*)<\/errorno>[\s\S]*?<description>([^<]*)<\/description>[\s\S]*?<\/error>/);
    if (errorMatch) {
      throw new Error(`Sage Intacct Error ${errorMatch[1]}: ${errorMatch[2]}`);
    }

    // Check for authentication error
    const authErrorMatch = xmlString.match(/<errormessage>[\s\S]*?<error>[\s\S]*?<errorno>([^<]*)<\/errorno>[\s\S]*?<description>([^<]*)<\/description>/);
    if (authErrorMatch) {
      throw new Error(`Authentication Error ${authErrorMatch[1]}: ${authErrorMatch[2]}`);
    }

    // Extract session ID if present
    const sessionMatch = xmlString.match(/<sessionid>([^<]+)<\/sessionid>/);
    if (sessionMatch) {
      result.sessionId = sessionMatch[1];
    }

    // Extract data array from response
    const dataMatch = xmlString.match(/<data[\s\S]*?>([\s\S]*?)<\/data>/);
    if (dataMatch) {
      result.data = this.parseDataElements(dataMatch[1]);
    }

    // Extract single record responses
    const recordMatch = xmlString.match(/<result>[\s\S]*?<data[\s\S]*?>([\s\S]*?)<\/data>[\s\S]*?<\/result>/);
    if (recordMatch && !result.data) {
      result.data = this.parseDataElements(recordMatch[1]);
    }

    return result;
  }

  private parseDataElements(dataXml: string): any[] {
    const records: any[] = [];

    // Match all record elements (VENDOR, APBILL, APPYMT, etc.)
    const recordTypes = ['VENDOR', 'APBILL', 'APPYMT', 'LOCATION'];

    for (const recordType of recordTypes) {
      const regex = new RegExp(`<${recordType}>([\\s\\S]*?)<\\/${recordType}>`, 'g');
      let match;

      while ((match = regex.exec(dataXml)) !== null) {
        const record = this.parseRecordFields(match[1], recordType);
        records.push(record);
      }
    }

    return records;
  }

  private parseRecordFields(recordXml: string, recordType: string): any {
    const record: any = { _type: recordType };

    // Extract simple fields
    const fieldRegex = /<([A-Z0-9_]+)>([^<]*)<\/\1>/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(recordXml)) !== null) {
      const fieldName = fieldMatch[1];
      let fieldValue: any = fieldMatch[2];

      // Convert numeric fields
      if (['TOTALAMOUNT', 'TOTALDUE', 'TOTALPAID', 'PAYMENTAMOUNT', 'AMOUNT'].includes(fieldName)) {
        fieldValue = parseFloat(fieldValue) || 0;
      }

      record[fieldName] = fieldValue;
    }

    // Parse nested DISPLAYCONTACT for vendors
    if (recordType === 'VENDOR') {
      const contactMatch = recordXml.match(/<DISPLAYCONTACT>([\s\S]*?)<\/DISPLAYCONTACT>/);
      if (contactMatch) {
        record.DISPLAYCONTACT = this.parseRecordFields(contactMatch[1], 'CONTACT');

        // Parse nested MAILADDRESS
        const addressMatch = contactMatch[1].match(/<MAILADDRESS>([\s\S]*?)<\/MAILADDRESS>/);
        if (addressMatch) {
          record.DISPLAYCONTACT.MAILADDRESS = this.parseRecordFields(addressMatch[1], 'ADDRESS');
        }
      }
    }

    // Parse APBILLITEMS for bills
    if (recordType === 'APBILL') {
      const itemsMatch = recordXml.match(/<APBILLITEMS>([\s\S]*?)<\/APBILLITEMS>/);
      if (itemsMatch) {
        const items: any[] = [];
        const itemRegex = /<APBILLITEM>([\s\S]*?)<\/APBILLITEM>/g;
        let itemMatch;

        while ((itemMatch = itemRegex.exec(itemsMatch[1])) !== null) {
          items.push(this.parseRecordFields(itemMatch[1], 'ITEM'));
        }

        record.APBILLITEMS = items;
      }
    }

    return record;
  }

  // ============================================================================
  // API REQUEST METHOD
  // ============================================================================

  private async makeRequest(
    connectionId: string,
    functions: string,
    entityId?: string
  ): Promise<any> {
    // Get connection details
    const [connection] = await sql`
      SELECT
        access_token,
        refresh_token,
        realm_id as company_id,
        intacct_user_id,
        intacct_user_password,
        intacct_session_id,
        intacct_session_expires,
        intacct_entity_id
      FROM erp_connections
      WHERE id = ${connectionId}
    `;

    if (!connection) {
      throw new Error('Sage Intacct connection not found');
    }

    const effectiveEntityId = entityId || connection.intacct_entity_id || this.defaultEntityId;

    // Build authentication - use session if valid, otherwise login
    let authentication: string;

    if (connection.intacct_session_id &&
        connection.intacct_session_expires &&
        new Date(connection.intacct_session_expires) > new Date()) {
      authentication = this.buildSessionAuthXML(connection.intacct_session_id);
    } else {
      authentication = this.buildAuthenticationXML(
        connection.company_id,
        connection.intacct_user_id,
        connection.intacct_user_password
      );
    }

    // Add entity context if specified
    let functionsWithEntity = functions;
    if (effectiveEntityId) {
      functionsWithEntity = functions.replace(
        /<function /g,
        `<function locationid="${this.escapeXML(effectiveEntityId)}" `
      );
    }

    const requestXml = this.buildRequest(authentication, functionsWithEntity);

    const response = await fetch(INTACCT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
      body: requestXml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sage Intacct HTTP error ${response.status}: ${errorText}`);
    }

    const responseXml = await response.text();
    const result = this.parseXMLResponse(responseXml);

    // Update session if new one was returned
    if (result.sessionId && result.sessionId !== connection.intacct_session_id) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Sessions typically last 1 hour

      await sql`
        UPDATE erp_connections
        SET
          intacct_session_id = ${result.sessionId},
          intacct_session_expires = ${expiresAt.toISOString()},
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;
    }

    return result;
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async getSession(
    companyId: string,
    userId: string,
    userPassword: string
  ): Promise<IntacctSession> {
    const authentication = this.buildAuthenticationXML(companyId, userId, userPassword);

    const functions = `
      <function controlid="getAPISession">
        <getAPISession/>
      </function>
    `;

    const requestXml = this.buildRequest(authentication, functions);

    const response = await fetch(INTACCT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
      body: requestXml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get session: ${errorText}`);
    }

    const responseXml = await response.text();
    const result = this.parseXMLResponse(responseXml);

    if (!result.sessionId) {
      throw new Error('No session ID returned from Sage Intacct');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      sessionId: result.sessionId,
      endpoint: INTACCT_ENDPOINT,
      expiresAt,
    };
  }

  async storeSession(
    connectionId: string,
    session: IntacctSession
  ): Promise<void> {
    await sql`
      UPDATE erp_connections
      SET
        intacct_session_id = ${session.sessionId},
        intacct_session_expires = ${session.expiresAt.toISOString()},
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;
  }

  // ============================================================================
  // ENTITY MANAGEMENT (Multi-Entity Support)
  // ============================================================================

  async getEntities(connectionId: string): Promise<IntacctEntity[]> {
    const functions = `
      <function controlid="getEntities">
        <readByQuery>
          <object>LOCATION</object>
          <fields>LOCATIONID,NAME,PARENTID,STATUS,CURRENCY,STARTDATE,ENDDATE</fields>
          <query>STATUS = 'active'</query>
          <pagesize>1000</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions);

    return (result.data || []).map((loc: any) => ({
      LOCATIONID: loc.LOCATIONID,
      NAME: loc.NAME,
      PARENTID: loc.PARENTID,
      STATUS: loc.STATUS || 'active',
      CURRENCY: loc.CURRENCY,
      STARTDATE: loc.STARTDATE,
      ENDDATE: loc.ENDDATE,
    }));
  }

  async setEntityContext(connectionId: string, entityId: string): Promise<void> {
    await sql`
      UPDATE erp_connections
      SET
        intacct_entity_id = ${entityId},
        updated_at = NOW()
      WHERE id = ${connectionId}
    `;
  }

  // ============================================================================
  // VENDOR METHODS
  // ============================================================================

  async fetchVendors(connectionId: string, entityId?: string): Promise<IntacctVendor[]> {
    const functions = `
      <function controlid="getVendors">
        <readByQuery>
          <object>VENDOR</object>
          <fields>VENDORID,NAME,DISPLAYCONTACT,STATUS,TAXID,CURRENCY,TERMNAME,PAYMETHOD,BANKACCOUNTNO,BANKROUTINGNO,WHENMODIFIED</fields>
          <query>STATUS = 'active'</query>
          <pagesize>1000</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);

    return (result.data || []).filter((v: any) => v._type === 'VENDOR').map((v: any) => ({
      VENDORID: v.VENDORID,
      NAME: v.NAME,
      DISPLAYCONTACT: v.DISPLAYCONTACT ? {
        CONTACTNAME: v.DISPLAYCONTACT.CONTACTNAME,
        EMAIL1: v.DISPLAYCONTACT.EMAIL1,
        PHONE1: v.DISPLAYCONTACT.PHONE1,
        MAILADDRESS: v.DISPLAYCONTACT.MAILADDRESS ? {
          ADDRESS1: v.DISPLAYCONTACT.MAILADDRESS.ADDRESS1,
          ADDRESS2: v.DISPLAYCONTACT.MAILADDRESS.ADDRESS2,
          CITY: v.DISPLAYCONTACT.MAILADDRESS.CITY,
          STATE: v.DISPLAYCONTACT.MAILADDRESS.STATE,
          ZIP: v.DISPLAYCONTACT.MAILADDRESS.ZIP,
          COUNTRY: v.DISPLAYCONTACT.MAILADDRESS.COUNTRY,
        } : undefined,
      } : undefined,
      STATUS: v.STATUS || 'active',
      TAXID: v.TAXID,
      CURRENCY: v.CURRENCY,
      TERMNAME: v.TERMNAME,
      PAYMETHOD: v.PAYMETHOD,
      BANKACCOUNTNO: v.BANKACCOUNTNO,
      BANKROUTINGNO: v.BANKROUTINGNO,
      WHENMODIFIED: v.WHENMODIFIED,
    }));
  }

  async fetchVendor(connectionId: string, vendorId: string, entityId?: string): Promise<IntacctVendor | null> {
    const functions = `
      <function controlid="getVendor">
        <read>
          <object>VENDOR</object>
          <keys>${this.escapeXML(vendorId)}</keys>
          <fields>VENDORID,NAME,DISPLAYCONTACT,STATUS,TAXID,CURRENCY,TERMNAME,PAYMETHOD,BANKACCOUNTNO,BANKROUTINGNO,WHENMODIFIED</fields>
        </read>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);
    const vendor = (result.data || []).find((v: any) => v._type === 'VENDOR');

    if (!vendor) return null;

    return {
      VENDORID: vendor.VENDORID,
      NAME: vendor.NAME,
      DISPLAYCONTACT: vendor.DISPLAYCONTACT,
      STATUS: vendor.STATUS || 'active',
      TAXID: vendor.TAXID,
      CURRENCY: vendor.CURRENCY,
      TERMNAME: vendor.TERMNAME,
      PAYMETHOD: vendor.PAYMETHOD,
      BANKACCOUNTNO: vendor.BANKACCOUNTNO,
      BANKROUTINGNO: vendor.BANKROUTINGNO,
      WHENMODIFIED: vendor.WHENMODIFIED,
    };
  }

  // ============================================================================
  // BILL METHODS
  // ============================================================================

  async fetchBills(connectionId: string, startDate?: Date, entityId?: string): Promise<IntacctBill[]> {
    let query = "STATE = 'Posted' AND TOTALDUE > 0";

    if (startDate) {
      const dateStr = startDate.toISOString().split('T')[0];
      query += ` AND WHENDUE >= '${dateStr}'`;
    }

    const functions = `
      <function controlid="getBills">
        <readByQuery>
          <object>APBILL</object>
          <fields>RECORDNO,RECORDID,VENDORID,VENDORNAME,WHENCREATED,WHENDUE,TOTALAMOUNT,TOTALDUE,TOTALPAID,CURRENCY,STATE,DESCRIPTION,LOCATIONID,DEPARTMENTID,PROJECTID</fields>
          <query>${this.escapeXML(query)}</query>
          <pagesize>1000</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);

    return (result.data || []).filter((b: any) => b._type === 'APBILL').map((b: any) => ({
      RECORDNO: b.RECORDNO,
      RECORDID: b.RECORDID,
      VENDORID: b.VENDORID,
      VENDORNAME: b.VENDORNAME,
      WHENCREATED: b.WHENCREATED,
      WHENDUE: b.WHENDUE,
      TOTALAMOUNT: parseFloat(b.TOTALAMOUNT) || 0,
      TOTALDUE: parseFloat(b.TOTALDUE) || 0,
      TOTALPAID: parseFloat(b.TOTALPAID) || 0,
      CURRENCY: b.CURRENCY,
      STATE: b.STATE,
      DESCRIPTION: b.DESCRIPTION,
      LOCATIONID: b.LOCATIONID,
      DEPARTMENTID: b.DEPARTMENTID,
      PROJECTID: b.PROJECTID,
    }));
  }

  async fetchBill(connectionId: string, billRecordNo: string, entityId?: string): Promise<IntacctBill | null> {
    const functions = `
      <function controlid="getBill">
        <read>
          <object>APBILL</object>
          <keys>${this.escapeXML(billRecordNo)}</keys>
          <fields>RECORDNO,RECORDID,VENDORID,VENDORNAME,WHENCREATED,WHENDUE,TOTALAMOUNT,TOTALDUE,TOTALPAID,CURRENCY,STATE,DESCRIPTION,LOCATIONID,DEPARTMENTID,PROJECTID,APBILLITEMS</fields>
        </read>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);
    const bill = (result.data || []).find((b: any) => b._type === 'APBILL');

    if (!bill) return null;

    return {
      RECORDNO: bill.RECORDNO,
      RECORDID: bill.RECORDID,
      VENDORID: bill.VENDORID,
      VENDORNAME: bill.VENDORNAME,
      WHENCREATED: bill.WHENCREATED,
      WHENDUE: bill.WHENDUE,
      TOTALAMOUNT: parseFloat(bill.TOTALAMOUNT) || 0,
      TOTALDUE: parseFloat(bill.TOTALDUE) || 0,
      TOTALPAID: parseFloat(bill.TOTALPAID) || 0,
      CURRENCY: bill.CURRENCY,
      STATE: bill.STATE,
      DESCRIPTION: bill.DESCRIPTION,
      LOCATIONID: bill.LOCATIONID,
      DEPARTMENTID: bill.DEPARTMENTID,
      PROJECTID: bill.PROJECTID,
      APBILLITEMS: bill.APBILLITEMS,
    };
  }

  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================

  async fetchPayments(connectionId: string, startDate?: Date, entityId?: string): Promise<IntacctPayment[]> {
    let query = "STATE != 'Reversed'";

    if (startDate) {
      const dateStr = startDate.toISOString().split('T')[0];
      query += ` AND PAYMENTDATE >= '${dateStr}'`;
    }

    const functions = `
      <function controlid="getPayments">
        <readByQuery>
          <object>APPYMT</object>
          <fields>RECORDNO,PAYMENTMETHOD,VENDORID,VENDORNAME,PAYMENTDATE,PAYMENTAMOUNT,CURRENCY,DOCNUMBER,BANKACCOUNTID,DESCRIPTION,STATE,LOCATIONID</fields>
          <query>${this.escapeXML(query)}</query>
          <pagesize>1000</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);

    return (result.data || []).filter((p: any) => p._type === 'APPYMT').map((p: any) => ({
      RECORDNO: p.RECORDNO,
      PAYMENTMETHOD: p.PAYMENTMETHOD,
      VENDORID: p.VENDORID,
      VENDORNAME: p.VENDORNAME,
      PAYMENTDATE: p.PAYMENTDATE,
      PAYMENTAMOUNT: parseFloat(p.PAYMENTAMOUNT) || 0,
      CURRENCY: p.CURRENCY,
      DOCNUMBER: p.DOCNUMBER,
      BANKACCOUNTID: p.BANKACCOUNTID,
      DESCRIPTION: p.DESCRIPTION,
      STATE: p.STATE,
      LOCATIONID: p.LOCATIONID,
    }));
  }

  async createPayment(
    connectionId: string,
    vendorId: string,
    billRecordNo: string,
    amount: number,
    paymentDate: Date,
    bankAccountId: string,
    options?: {
      paymentMethod?: string;
      memo?: string;
      entityId?: string;
    }
  ): Promise<IntacctPayment> {
    const dateStr = paymentDate.toISOString().split('T')[0];
    const paymentMethod = options?.paymentMethod || 'EFT';
    const memo = options?.memo || 'Paid via Wells AI';

    const functions = `
      <function controlid="createPayment">
        <create>
          <APPYMT>
            <PAYMENTMETHOD>${this.escapeXML(paymentMethod)}</PAYMENTMETHOD>
            <BANKACCOUNTID>${this.escapeXML(bankAccountId)}</BANKACCOUNTID>
            <VENDORID>${this.escapeXML(vendorId)}</VENDORID>
            <PAYMENTDATE>${dateStr}</PAYMENTDATE>
            <CURRENCY>USD</CURRENCY>
            <DESCRIPTION>${this.escapeXML(memo)}</DESCRIPTION>
            <APPYMTDETAILS>
              <APPYMTDETAIL>
                <RECORDKEY>${this.escapeXML(billRecordNo)}</RECORDKEY>
                <TRX_PAYMENTAMOUNT>${amount}</TRX_PAYMENTAMOUNT>
              </APPYMTDETAIL>
            </APPYMTDETAILS>
          </APPYMT>
        </create>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, options?.entityId);

    // Extract created payment record number
    const payment = (result.data || []).find((p: any) => p._type === 'APPYMT');
    const recordNo = payment?.RECORDNO || `WELLS-${Date.now()}`;

    return {
      RECORDNO: recordNo,
      PAYMENTMETHOD: paymentMethod,
      VENDORID: vendorId,
      PAYMENTDATE: dateStr,
      PAYMENTAMOUNT: amount,
      CURRENCY: 'USD',
      BANKACCOUNTID: bankAccountId,
      DESCRIPTION: memo,
      STATE: 'Posted',
      LOCATIONID: options?.entityId,
    };
  }

  // ============================================================================
  // DATABASE SYNC METHODS
  // ============================================================================

  async syncVendorToDatabase(connectionId: string, vendor: IntacctVendor): Promise<void> {
    const email = vendor.DISPLAYCONTACT?.EMAIL1 || null;
    const phone = vendor.DISPLAYCONTACT?.PHONE1 || null;
    const address = vendor.DISPLAYCONTACT?.MAILADDRESS;

    await sql`
      INSERT INTO erp_vendors (
        erp_connection_id,
        external_vendor_id,
        vendor_name,
        vendor_display_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        tax_id,
        is_active,
        default_currency,
        payment_terms,
        bank_account_number,
        routing_number,
        payment_method,
        raw_data
      ) VALUES (
        ${connectionId},
        ${vendor.VENDORID},
        ${vendor.NAME},
        ${vendor.DISPLAYCONTACT?.CONTACTNAME || vendor.NAME},
        ${email},
        ${phone},
        ${address?.ADDRESS1 || null},
        ${address?.ADDRESS2 || null},
        ${address?.CITY || null},
        ${address?.STATE || null},
        ${address?.ZIP || null},
        ${address?.COUNTRY || 'US'},
        ${vendor.TAXID || null},
        ${vendor.STATUS === 'active'},
        ${vendor.CURRENCY || 'USD'},
        ${vendor.TERMNAME || null},
        ${vendor.BANKACCOUNTNO || null},
        ${vendor.BANKROUTINGNO || null},
        ${vendor.PAYMETHOD || null},
        ${JSON.stringify(vendor)}
      )
      ON CONFLICT (erp_connection_id, external_vendor_id)
      DO UPDATE SET
        vendor_name = EXCLUDED.vendor_name,
        vendor_display_name = EXCLUDED.vendor_display_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        country = EXCLUDED.country,
        tax_id = EXCLUDED.tax_id,
        is_active = EXCLUDED.is_active,
        default_currency = EXCLUDED.default_currency,
        payment_terms = EXCLUDED.payment_terms,
        bank_account_number = EXCLUDED.bank_account_number,
        routing_number = EXCLUDED.routing_number,
        payment_method = EXCLUDED.payment_method,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  async syncBillToDatabase(connectionId: string, bill: IntacctBill): Promise<void> {
    const wellsFee = bill.TOTALAMOUNT * 0.01; // 1%
    const paymentCostSaved = bill.TOTALAMOUNT > 10000 ? 35 : 25; // Higher savings for multi-entity
    const netSavings = paymentCostSaved - wellsFee;
    const isPaid = bill.TOTALDUE === 0;

    await sql`
      INSERT INTO erp_bills (
        erp_connection_id,
        external_bill_id,
        external_vendor_id,
        bill_number,
        vendor_name,
        total_amount,
        currency,
        bill_date,
        due_date,
        status,
        paid_status,
        amount_paid,
        wells_fee_amount,
        payment_cost_saved,
        net_customer_savings,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${bill.RECORDNO},
        ${bill.VENDORID},
        ${bill.RECORDID || null},
        ${bill.VENDORNAME || 'Unknown Vendor'},
        ${bill.TOTALAMOUNT},
        ${bill.CURRENCY || 'USD'},
        ${bill.WHENCREATED},
        ${bill.WHENDUE},
        ${isPaid ? 'paid_external' : 'pending'},
        ${isPaid ? 'paid' : 'unpaid'},
        ${bill.TOTALPAID || 0},
        ${wellsFee},
        ${paymentCostSaved},
        ${netSavings},
        ${bill.DESCRIPTION || null},
        ${JSON.stringify(bill)}
      )
      ON CONFLICT (erp_connection_id, external_bill_id)
      DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        status = EXCLUDED.status,
        paid_status = EXCLUDED.paid_status,
        amount_paid = EXCLUDED.amount_paid,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  async syncPaymentToDatabase(connectionId: string, payment: IntacctPayment): Promise<void> {
    await sql`
      INSERT INTO erp_payments (
        erp_connection_id,
        external_payment_id,
        external_vendor_id,
        payment_amount,
        payment_method,
        payment_date,
        bank_account_id,
        memo,
        raw_data
      ) VALUES (
        ${connectionId},
        ${payment.RECORDNO},
        ${payment.VENDORID},
        ${payment.PAYMENTAMOUNT},
        ${payment.PAYMENTMETHOD || 'intacct'},
        ${payment.PAYMENTDATE},
        ${payment.BANKACCOUNTID || null},
        ${payment.DESCRIPTION || null},
        ${JSON.stringify(payment)}
      )
      ON CONFLICT (erp_connection_id, external_payment_id)
      DO UPDATE SET
        payment_amount = EXCLUDED.payment_amount,
        payment_method = EXCLUDED.payment_method,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `;
  }

  // ============================================================================
  // FULL SYNC
  // ============================================================================

  async fullSync(connectionId: string, entityId?: string): Promise<{
    vendorsFound: number;
    billsFound: number;
    paymentsFound: number;
    entitiesFound: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let vendorsFound = 0;
    let billsFound = 0;
    let paymentsFound = 0;
    let entitiesFound = 0;

    try {
      // Sync entities first (for multi-entity support)
      try {
        const entities = await this.getEntities(connectionId);
        entitiesFound = entities.length;
      } catch (error) {
        errors.push(`Entities: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Sync vendors
      try {
        const vendors = await this.fetchVendors(connectionId, entityId);
        for (const vendor of vendors) {
          try {
            await this.syncVendorToDatabase(connectionId, vendor);
            vendorsFound++;
          } catch (error) {
            errors.push(`Vendor ${vendor.VENDORID}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        errors.push(`Vendors: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Sync bills
      try {
        const bills = await this.fetchBills(connectionId, undefined, entityId);
        for (const bill of bills) {
          try {
            await this.syncBillToDatabase(connectionId, bill);
            billsFound++;
          } catch (error) {
            errors.push(`Bill ${bill.RECORDNO}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        errors.push(`Bills: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Sync recent payments (last 30 days)
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const payments = await this.fetchPayments(connectionId, thirtyDaysAgo, entityId);
        for (const payment of payments) {
          try {
            await this.syncPaymentToDatabase(connectionId, payment);
            paymentsFound++;
          } catch (error) {
            errors.push(`Payment ${payment.RECORDNO}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } catch (error) {
        errors.push(`Payments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Update connection sync status
      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = ${errors.length > 0 ? 'completed_with_errors' : 'completed'},
          last_sync_error = ${errors.length > 0 ? errors.slice(0, 5).join('; ') : null},
          next_sync_at = NOW() + INTERVAL '4 hours',
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await sql`
        UPDATE erp_connections
        SET
          last_sync_at = NOW(),
          last_sync_status = 'failed',
          last_sync_error = ${errorMessage}
        WHERE id = ${connectionId}
      `;

      errors.push(errorMessage);
    }

    return {
      vendorsFound,
      billsFound,
      paymentsFound,
      entitiesFound,
      errors,
    };
  }

  // ============================================================================
  // TEST CONNECTION
  // ============================================================================

  async testConnection(connectionId: string): Promise<boolean> {
    try {
      // Try to read a single vendor to verify connectivity
      const functions = `
        <function controlid="testConnection">
          <readByQuery>
            <object>VENDOR</object>
            <fields>VENDORID</fields>
            <query></query>
            <pagesize>1</pagesize>
          </readByQuery>
        </function>
      `;

      await this.makeRequest(connectionId, functions);
      return true;
    } catch (error) {
      console.error('Sage Intacct connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // COMPANY INFO
  // ============================================================================

  async getCompanyInfo(connectionId: string): Promise<{
    companyId: string;
    companyName: string;
    entities: IntacctEntity[];
  } | null> {
    try {
      const [connection] = await sql`
        SELECT realm_id as company_id, company_name
        FROM erp_connections
        WHERE id = ${connectionId}
      `;

      if (!connection) return null;

      const entities = await this.getEntities(connectionId);

      return {
        companyId: connection.company_id,
        companyName: connection.company_name || connection.company_id,
        entities,
      };
    } catch (error) {
      console.error('Failed to get company info:', error);
      return null;
    }
  }

  // ============================================================================
  // BANK ACCOUNTS (for payment creation)
  // ============================================================================

  async getBankAccounts(connectionId: string, entityId?: string): Promise<Array<{
    BANKACCOUNTID: string;
    BANKACCOUNTNAME: string;
    BANKNAME?: string;
    CURRENCY?: string;
  }>> {
    const functions = `
      <function controlid="getBankAccounts">
        <readByQuery>
          <object>CHECKINGACCOUNT</object>
          <fields>BANKACCOUNTID,BANKACCOUNTNAME,BANKNAME,CURRENCY</fields>
          <query>STATUS = 'active'</query>
          <pagesize>100</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);

    return (result.data || []).map((ba: any) => ({
      BANKACCOUNTID: ba.BANKACCOUNTID,
      BANKACCOUNTNAME: ba.BANKACCOUNTNAME,
      BANKNAME: ba.BANKNAME,
      CURRENCY: ba.CURRENCY,
    }));
  }

  // ============================================================================
  // DIMENSIONS (CFO Analytics Support)
  // ============================================================================

  async getDepartments(connectionId: string, entityId?: string): Promise<Array<{
    DEPARTMENTID: string;
    TITLE: string;
    STATUS: string;
  }>> {
    const functions = `
      <function controlid="getDepartments">
        <readByQuery>
          <object>DEPARTMENT</object>
          <fields>DEPARTMENTID,TITLE,STATUS</fields>
          <query>STATUS = 'active'</query>
          <pagesize>200</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);

    return (result.data || []).map((d: any) => ({
      DEPARTMENTID: d.DEPARTMENTID,
      TITLE: d.TITLE,
      STATUS: d.STATUS || 'active',
    }));
  }

  async getProjects(connectionId: string, entityId?: string): Promise<Array<{
    PROJECTID: string;
    NAME: string;
    STATUS: string;
    CUSTOMERID?: string;
  }>> {
    const functions = `
      <function controlid="getProjects">
        <readByQuery>
          <object>PROJECT</object>
          <fields>PROJECTID,NAME,STATUS,CUSTOMERID</fields>
          <query>STATUS = 'active'</query>
          <pagesize>200</pagesize>
        </readByQuery>
      </function>
    `;

    const result = await this.makeRequest(connectionId, functions, entityId);

    return (result.data || []).map((p: any) => ({
      PROJECTID: p.PROJECTID,
      NAME: p.NAME,
      STATUS: p.STATUS || 'active',
      CUSTOMERID: p.CUSTOMERID,
    }));
  }
}

export const sageIntacct = new SageIntacctService();

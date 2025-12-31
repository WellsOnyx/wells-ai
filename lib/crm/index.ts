/**
 * CRM Module - Central exports
 */

// Types
export * from './types'

// Contact management
export {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
  deleteContacts,
  importContactsFromCSV,
  parseCSV,
  createList,
  getLists,
  addContactsToList,
  removeContactsFromList,
  deleteList,
  getTags,
  addTagsToContacts,
  removeTagsFromContacts,
  getContactStats,
} from './contacts'

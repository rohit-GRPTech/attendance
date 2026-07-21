import type { ApplicationDefinition } from '../types/application';
import { baseDefinition, dashboardPage, entity, field, listPage, notifyWorkflow, options } from './builders';

const products = entity('products', 'Product', 'Products', 'name', [
  field('name', 'Product name', 'short_text', { required: true }),
  field('sku', 'SKU', 'short_text', { required: true, unique: true }),
  field('category', 'Category', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'categories', displayFieldKey: 'name' } }),
  field('unit_price', 'Unit price', 'currency', { required: true, min: 0 }),
  field('stock_on_hand', 'Stock on hand', 'number', { required: true, min: 0, defaultValue: 0 }),
  field('reorder_level', 'Reorder level', 'number', { min: 0, defaultValue: 10 }),
  field('status', 'Status', 'status', { defaultValue: 'active', options: options('Active', 'Discontinued', 'Out of stock') }),
], 'package');

const categories = entity('categories', 'Category', 'Categories', 'name', [
  field('name', 'Category name', 'short_text', { required: true, unique: true }),
  field('description', 'Description', 'long_text'),
], 'tags');

const suppliers = entity('suppliers', 'Supplier', 'Suppliers', 'name', [
  field('name', 'Supplier name', 'short_text', { required: true }),
  field('contact_email', 'Contact email', 'email'),
  field('phone', 'Phone', 'phone'),
  field('lead_time_days', 'Lead time (days)', 'number', { min: 0 }),
  field('rating', 'Rating', 'select', { options: options('Excellent', 'Good', 'Average', 'Poor') }),
], 'truck');

const warehouses = entity('warehouses', 'Warehouse', 'Warehouses', 'name', [
  field('name', 'Warehouse name', 'short_text', { required: true }),
  field('location', 'Location', 'short_text'),
  field('capacity_units', 'Capacity (units)', 'number', { min: 0 }),
], 'warehouse');

const stockMovements = entity('stock_movements', 'Stock movement', 'Stock movements', 'reference', [
  field('reference', 'Reference', 'auto_number', { readOnly: true }),
  field('product', 'Product', 'relation', { required: true, relation: { kind: 'many_to_one', targetEntityKey: 'products', displayFieldKey: 'name' } }),
  field('warehouse', 'Warehouse', 'relation', { relation: { kind: 'many_to_one', targetEntityKey: 'warehouses', displayFieldKey: 'name' } }),
  field('movement_type', 'Type', 'select', { required: true, options: options('Inbound', 'Outbound', 'Adjustment', 'Transfer') }),
  field('quantity', 'Quantity', 'number', { required: true }),
  field('moved_at', 'Date', 'date', { required: true }),
], 'arrow-left-right');

const purchaseOrders = entity('purchase_orders', 'Purchase order', 'Purchase orders', 'po_number', [
  field('po_number', 'PO number', 'short_text', { required: true, unique: true }),
  field('supplier', 'Supplier', 'relation', { required: true, relation: { kind: 'many_to_one', targetEntityKey: 'suppliers', displayFieldKey: 'name' } }),
  field('status', 'Status', 'status', { required: true, defaultValue: 'draft', options: options('Draft', 'Sent', 'Approved', 'Received', 'Cancelled') }),
  field('order_total', 'Order total', 'currency', { min: 0 }),
  field('expected_delivery', 'Expected delivery', 'date'),
], 'clipboard-list');

const entities = [products, categories, suppliers, warehouses, stockMovements, purchaseOrders];

const pages = [
  dashboardPage('dashboard', 'Inventory dashboard', [
    { label: 'Products', entityKey: 'products' },
    { label: 'Suppliers', entityKey: 'suppliers' },
    { label: 'Open purchase orders', entityKey: 'purchase_orders' },
    { label: 'Movements this month', entityKey: 'stock_movements' },
  ], { entityKey: 'purchase_orders', groupByFieldKey: 'status', title: 'Purchase orders by status' }),
  listPage('products', 'Products', 'products', 'package', ['name', 'sku', 'unit_price', 'stock_on_hand', 'reorder_level', 'status']),
  listPage('low-stock', 'Low-stock items', 'products', 'alert-triangle', ['name', 'sku', 'stock_on_hand', 'reorder_level']),
  listPage('suppliers', 'Suppliers', 'suppliers', 'truck', ['name', 'contact_email', 'lead_time_days', 'rating']),
  listPage('purchase-orders', 'Purchase orders', 'purchase_orders', 'clipboard-list', ['po_number', 'supplier', 'status', 'order_total', 'expected_delivery']),
  listPage('stock-history', 'Stock history', 'stock_movements', 'arrow-left-right', ['reference', 'product', 'movement_type', 'quantity', 'moved_at']),
];

const workflows = [
  notifyWorkflow('inv', 'Low stock alert', 'stock_movements', 'A product has dropped below its reorder level.'),
  {
    ...notifyWorkflow('inv', 'Stock updated', 'stock_movements', 'Stock levels were updated after a movement.'),
    trigger: { type: 'record_created' as const, entityKey: 'stock_movements' },
  },
  {
    ...notifyWorkflow('inv', 'Purchase order approval', 'purchase_orders', 'A purchase order is waiting for approval.'),
    trigger: { type: 'record_updated' as const, entityKey: 'purchase_orders' },
  },
];

export const inventorySample: ApplicationDefinition = baseDefinition(
  'inventory_management',
  'Inventory Management',
  'Manage products, suppliers, warehouses, purchase orders and stock movements with low-stock alerts.',
  'inventory',
  'package',
  entities,
  pages,
  workflows,
);

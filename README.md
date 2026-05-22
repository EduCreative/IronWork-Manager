# IronWork Manager

A comprehensive multi-user inventory and sales management system built for steel fabrication businesses.

## Features
- Dashboard with real-time analytics
- Product and Stock Management
- Customer and Supplier Tracking
- Professional Invoice Generation (PDF)
- Expense and Purchase Logging
- Secure Backup and Restore with Data Validation
- Multi-user Authentication

## Updates
### [1.6.0] - 2026-05-22
- **Unified Version Alignment**: Updated structural components including the sidebar navigation, secure login portal, and system manifest (`package.json`) to accurately reflect the unified version `v1.6.0`.
- **Smooth Theme Cross-Fade Transitions**: Added a global 500ms easing transition for all layout components (aside, header, main, cards, and text) to create a premium cross-fade effect when toggling between light, dark, and system modes.
- **Enhanced Light-Theme Contrast & Accessibility**: Upgraded standard gray and slate muted colors to darker, high-contrast values specifically in light-mode, ensuring all subheadings, placeholders, table cells, and form labels comfortably meet AA/AAA web accessibility guidelines.
- **Manual Toggle Variant Integration for Tailwind v4**: Standardized class-toggled styling behaviors under Tailwind v4 by officially defining the class-based `@variant dark` utility within the core styling dictionary. This guarantees immediate dark styles responsiveness when toggling themes regardless of user OS media query states.
- **Dashboard & Core View Polish**: Standardized strong explicit colors (`text-gray-900`/`text-gray-700`) for data values throughout the Invoices, Customer ledger search filters, User indices, and Expense charts, eliminating low-contrast and nested CSS invisibility issues completely.

### [1.5.2] - 2026-05-22
- **Global Dynamic Branding Integration**: Replaced remaining hardcoded "ForgeSteel" strings on the Login and Dashboard pages to pull from your real-time cloud configuration, ensuring a unified, fully rebranded "IronWork Manager" brand experience.
- **Dynamic Configuration fallbacks**: Updated system fallbacks in `ConfigContext.tsx` to "IronWork Manager" by default for fresh sessions prior to user-defined customizations.

### [1.5.1] - 2026-05-22
- **Branding Update**: Rebranded the entire application reference to **IronWork Manager** and updated the primary browser title.
- **Custom SVG Favicon**: Built a responsive, modern industrial vector SVG favicon representing steel structures and the 'IronWork' brand.

### [1.5.0] - 2026-05-22
- **Expenses Analysis Component**: Created a high-precision, stacked bar chart report reflecting live expense allocation and category cost trends over the last 6 months.
- **Low Stock Notification Badge**: Integrated a real-time reactive counter on the sidebar to highlight items below critical stock limits.
- **Low Stock Dashboard Alert**: Added an interactive warning banner on the main page to prevent inventory depletion.

### [1.4.0] - 2026-05-11
- **Master Data Reset**: Implemented a "Danger Zone" in Settings to wipe all database collections, protected by an 11-digit master security key.
- **Project Migration Infrastructure**: Added framework for isolating production data into dedicated Google Cloud/Firebase projects.
- **Fabrication UX Polish**: Added escape-hatch navigation (Cancel/Close) to the Production module and expanded material selection logic.
- **Industrial Sample Suite**: Upgraded sample data with complex recipes (BOM) for Gates, Grills, and Racks to demonstrate the new conversion logic.

### [1.3.0] - 2026-05-09
- **Manufacturing Module**: Introduced a comprehensive Fabrication system for converting raw materials into finished units.
- **Bill of Materials (BOM)**: Added support for defining product recipes and consumption ratios per finished item.
- **Conversion Accounting**: Automated stock deduction of raw materials and increment of finished goods with updated valuation.
- **BOM Profit Analysis**: Unit production costs are now calculated dynamically, allowing for precision margin tracking.
- **Dynamic Unit Support**: Added `sq m` (Square Meter) to the system for fabricated item billing.

### [1.2.4] - 2026-05-06
- **Critical Stability Fix**: Resolved Firestore transaction errors occurring during Invoice and Purchase generation by re-ordering database operations (ensuring all reads precede all writes).
- **Data Consistency**: Hardened stock adjustment and ledger update logic to prevent atomicity failures in high-volume environments.

### [1.2.3] - 2026-05-02
- **Documentation Release**: Launched a detailed `CLIENT_REPORT.md` providing a full feature audit and user manual for stakeholders.
- **Project Transparency**: Documented all menus, sub-modules, and the underlying database structure to facilitate future change requests.

### [1.2.2] - 2026-05-02
- **Extended Company Branding**: Added fields for Company Address, Contact Number, and Email to General Settings.
- **Header Customization for Print**: Company contact details (Address, Phone, Email) now dynamically appear in the headers of all exported PDF documents.
- **Comprehensive PDF Coverage**: Standardized PDF headers across Invoices, Inventory Reports, Customer Ledgers, Supplier Statements, and individual Purchase/Invoice Vouchers.
- **Purchase Export Functionality**: Enabled direct "Download Voucher" action for recorded material purchases in the Purchase History module.

### [1.2.1] - 2026-05-02
- **Interactive Contact Views**: Phone numbers, emails, WhatsApp numbers, and addresses for Customers and Suppliers are now clickable (tel:, mailto:, wa.me, Google Maps).
- **One-Click Copy Support**: Added copy-to-clipboard functionality for all contact details with visual confirmation icons.
- **Extended Contact Fields**: Expanded Customer and Supplier profiles to include dedicated Email and WhatsApp fields.
- **Enhanced Data Blueprint**: Synchronized database structure with the new interactive communication features.

### [1.2.0] - 2026-05-02
- **Aesthetic Overhaul (v2)**: Implemented a more comfortable slate-based color palette for both themes to further reduce eye strain.
- **UI Logic Synchronization**: Aligned the dynamic theme controller with CSS variables for perfect visual consistency.
- **Sidebar UX Improvement**: Redesigned sidebar navigation with high-contrast active states and theme-consistent hover effects.
- **Table Visibility Audit**: Hardened table styling across the entire app (Inventory, Invoices, Purchases) with prominent headers and clearer labels.
- **Fixed Thematic Inconsistencies**: Resolved issues where dark-mode colors were leaking into the light theme.

### [1.1.9] - 2026-05-02
- **Fixed Persistent Sequence Numbering**: Resolved an issue where next invoice numbers were not fetching correctly due to security rule constraints.
- **Enhanced Numbering Visibility**: Redesigned the invoice reference display to be more prominent and clearer for users during creation.
- **Database Architecture Alignment**: Synchronized the firestore blueprint with new sequence counters for better system integrity.

### [1.1.8] - 2026-05-02
- **Sequential Invoicing**: Implemented a persistent, auto-incrementing invoice numbering system (`INV-YYYY-XXXX`).
- **Yearly Numbering Reset**: The invoice sequence now automatically resets to `0001` at the start of each new calendar year.
- **Transactional Integrity**: Integrated database transactions to ensure guaranteed uniqueness of invoice numbers across multiple users.

### [1.1.7] - 2026-05-02
- **Sales Tax Integration**: Added support for specifying a sales tax percentage during invoice creation.
- **Automated Tax Calculation**: Tax is now automatically calculated on the net amount (Subtotal - Discount) and added to the total balance.
- **Dynamic Receipts & PDFs**: Tax details (rate and amount) are now clearly displayed in the transaction details and exported PDF statements.

### [1.1.6] - 2026-05-02
- **Visual Comfort Update**: Dimmed the light theme background (from bright white to soft slate-gray) to reduce eye strain.
- **UI Consistency Audit**: Resolved inconsistencies where dark-mode elements appeared in the light theme (Sidebar hovers, Inventory category tags, Card backgrounds).
- **Enhanced Visibility**: Improved contrast for table headers and metadata labels across Inventory, Invoices, and Purchases.

### [1.1.5] - 2026-05-02
- **Fixed Ledger Calculations**: Corrected the mathematical transparency by including "Opening Balance/Liability" in customer and supplier summaries.
- **Statement PDF Export**: Added functionality to export full account statements (ledger history) for both customers and suppliers.
- **Improved UI Transparency**: Added explicit labels for Opening Balance, Total Invoiced, Total Payments, and Net Outstanding in the ledger views.

### [1.1.4] - 2026-05-02
- **Unified Financial Ledger**: Integrated customer and supplier ledgers accessible via clickable names throughout the app.
- **Transaction History**: Detailed view of past invoices (for customers) and purchases (for suppliers) with full breakdown of items.
- **Voucher Printing**: Enhanced print/PDF generation for individual invoices and purchase vouchers directly from ledger views.
- **Cross-page Linking**: Customer and supplier names in Invoice and Purchase tables now link directly to their respective account ledgers.

### [1.1.3] - 2026-05-01
- **Inventory Reporting**: Added PDF export functionality to Inventory Management for easy printing and sharing of stock levels.
- **Enhanced Purchase Tracking**: Improved purchase entry list with better mobile responsiveness and layout.

### [1.1.2] - 2026-05-01
- **Admin Edit for Expenses**: Admin users can now modify historical expense records.
- **Smart Data Tables for Expenses**: Added advanced search, multi-column sorting, and refined UI for expense tracking.
- **Improved Expense Dashboard**: Added category-wise breakdown and higher density layout for expense overview.

### [1.1.1] - 2026-05-01
- **Recorded Payment for Purchases**: Added ability to settle pending payments for material purchases.
- **Supplier Balance Integration**: Purchases and payments now correctly update the supplier's outstanding debt.
- **Mobile-Optimized Purchase Entry**: Reordered purchase form (Date -> Supplier -> Materials -> Summary) for better mobile UX.
- **Smart Data Tables for Purchases**: Added search, sorting, and action-based interactions to the purchase history.
- **Purchase Entry Date**: Added manual date selection for recording material purchases.

### [1.1.0] - 2026-05-01
- **Mobile-Optimized Invoice Creation**: Reordered form sections (Date -> Customer -> Products -> Items -> Summary) for better mobile accessibility.
- **Enhanced Debt Tracking**: Added integration of "Previous Customer Balance" directly in the invoice creation summary.
- **Improved Date Handling**: Added manual date selection for new invoices.
- **UI Refinements**: Polished table headers, button states, and invoice creation layout.

### [1.0.9] - 2026-05-01
- **Recorded Payment Feature**: Added ability to record payments for existing invoices.
- **Dynamic Status Updates**: Invoices now automatically transition between Unpaid, Partial, and Paid based on payments.
- **Customer Balance Integration**: Recording a payment now correctly reduces the customer's pending debt balance.

### [1.0.8] - 2026-05-01
- **Smart Data Tables**: Implemented interactive sorting for Invoices. You can now sort billing records by Invoice #, Date, Customer, Amount, and Status with a single click.
- **Enhanced UI Feedback**: Added Chevron sort indicators and hover states to table headers.

### [1.0.7] - 2026-05-01
- **Real Data Dashboard**: Added live data aggregation for "Sales Performance" and "Expense Distribution" charts.
- **Improved Time Ranges**: Added "Last 3 Months" as the default view for sales trends.
- **Fixed Action Buttons**: Updated "Export Report" to generate live CSV data and fixed "New Invoice" navigation.
- **Performance**: Optimized dashboard data fetching with consolidated queries.

### [1.0.6] - 2026-05-01
- **Comprehensive Tooltip Integration**: Added descriptive tooltips (title attributes) to all interactive elements across the application (buttons, icons, links) to improve accessibility and user guidance.
- **Fixed UI Inconsistencies**: Refined button transition states and hover effects in Customers and Invoices modules.

### [1.0.5] - 2026-05-01
- **Fixed Invoice Viewing**: Implemented the "View" action (eye icon) in Invoices & Billing using a detailed modal preview.
- **Enhanced Modal UI**: Improved the look and feel of the invoice detail modal with better spacing and high-contrast summary sections.

### [1.0.4] - 2026-05-01
- **Fixed PDF Generation**: Resolved "autoTable is not a function" error by updating to the functional import pattern for `jspdf-autotable`.
- **Improved PDF Layout**: Refined header and summary positioning in generated invoices.

### [1.0.3] - 2026-05-01
- **Developer & About Page**: Added a dedicated About page with developer contact info (Masroor Khan).
- **Version Display**: Current system version is now visible in the sidebar next to the logo.
- **Theme Switcher**: Restored the quick-toggle button for Dark/Light/System modes in the topbar.
- **Mobile UX Refinement**: 
  - Added a backdrop overlay for mobile sidebar.
  - Improved mobile drawer transition and close button accessibility.
  - Adjusted mobile layout to ensure content visibility while sidebar is active.

### [1.0.2] - 2026-05-01
- **Graphical Progress Indicator**: Added a global progress bar in the topbar for long-running operations.
- **Detailed Operation Status**: Topbar now shows real-time messages (e.g., "Restoring invoices...") and percentages during backup/restore.
- **Improved Backup Service**: Enhanced back-end service to report granular progress.

### [1.0.1] - 2026-05-01
- **Enhanced Data Integrity**: Added validation checks for restore files.
- **Restore Preview**: Implemented a preview modal to inspect data before overwriting.
- **Rich Sample Data**: Updated sample backup with 2+ months of realistic business records.
- **Bug Fixes**: 
  - Fixed `.toDate()` crashes when importing JSON date strings.
  - Resolved Dashboard crash on initial load or null stats.

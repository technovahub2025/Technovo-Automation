# Broadcast Components

This folder contains all Broadcast and WhatsApp messaging-related components, organized for better maintainability and separation of concerns.

## Folder Structure

```
broadcastComponents/
├── index.js                    # Export all components
├── README.md                   # This file
├── BroadcastHeader.jsx         # Page header with title and actions
├── DateRangeFilter.jsx         # Date range filter controls
├── OverviewStats.jsx           # Statistics cards overview
├── BroadcastFilters.jsx        # Search, filter, and sort controls
├── BroadcastTable.jsx          # Main campaigns table
├── BroadcastCard.jsx           # Individual campaign row
├── ScheduleForm.jsx            # Campaign creation form
├── MessagePreview.jsx          # WhatsApp message preview
├── DeleteModal.jsx             # Delete confirmation modal
├── BroadcastTypeChoice.jsx     # Broadcast type selection dialog
├── NewBroadcastPopup.jsx       # New broadcast creation popup
├── CsvPreviewPopup.jsx         # CSV file preview popup
├── AllCampaignsPopup.jsx       # All campaigns view popup
├── BroadcastResultsPopup.jsx   # Broadcast results display
├── BulkMessaging.jsx           # Bulk messaging functionality
├── CampaignResults.jsx         # Campaign results analysis
├── CampaignResultsModal.jsx    # Campaign results modal
├── TemplateManagement.jsx      # WhatsApp template management
└── [CSS files]               # All related CSS files
```

## Component Descriptions

### BroadcastHeader
- **Purpose**: Displays the page header with title, description, and action buttons
- **Props**: `activeTab`, `onShowBroadcastTypeChoice`
- **Features**: Shows "New Broadcast" button on overview tab

### DateRangeFilter
- **Purpose**: Provides date range filtering and export functionality
- **Props**: Date states, handlers, and export function
- **Features**: Date pickers, period selection, and CSV export

### OverviewStats
- **Purpose**: Displays campaign statistics in a grid layout
- **Props**: `stats` object with campaign metrics
- **Features**: Shows sent, delivered, read, replied, sending, failed, processing, and queued counts

### BroadcastFilters
- **Purpose**: Provides search, filter, and sort controls for the campaign list
- **Props**: Filter states, dropdown visibility, and handler functions
- **Features**: Search box, status filter, date range filter, sort options, and refresh button

### BroadcastTable
- **Purpose**: Renders the main campaigns table with headers and rows
- **Props**: Campaign data, selection state, and action handlers
- **Features**: Checkbox selection, sortable columns, and action buttons

### BroadcastCard
- **Purpose**: Renders a single campaign row in the table
- **Props**: Individual campaign data and action handlers
- **Features**: Progress indicators, status badges, and action buttons

### ScheduleForm
- **Purpose**: Comprehensive form for creating new campaigns
- **Props**: Form data, template data, handlers, and validation
- **Features**: Template selection, custom message input, CSV upload, scheduling

### MessagePreview
- **Purpose**: WhatsApp-style message preview
- **Props**: Message type, content, and recipient count
- **Features**: Realistic WhatsApp UI mockup with message formatting

### DeleteModal
- **Purpose**: Confirmation modal for deleting campaigns
- **Props**: Modal visibility, selected campaigns, and handlers
- **Features**: Single and bulk delete support with campaign details

### BroadcastTypeChoice
- **Purpose**: Dialog for choosing between template and custom messages
- **Props**: Modal visibility and choice handlers
- **Features**: Template vs custom message selection with descriptions

### NewBroadcastPopup
- **Purpose**: Popup for creating new broadcasts
- **Props**: Form data, handlers, and validation
- **Features**: Simplified broadcast creation with essential fields

### CsvPreviewPopup
- **Purpose**: Preview uploaded CSV data before sending
- **Props**: CSV data, file info, and handlers
- **Features**: Table preview with first 5 rows and file statistics

### AllCampaignsPopup
- **Purpose**: Modal showing all campaigns with filtering
- **Props**: Campaign data, filter states, and handlers
- **Features**: Full campaign list with search and filter capabilities

### BroadcastResultsPopup
- **Purpose**: Display broadcast sending results and statistics
- **Props**: Results data, modal visibility, and handlers
- **Features**: Success rates, failed counts, and detailed metrics

### BulkMessaging
- **Purpose**: Bulk messaging interface for sending campaigns
- **Props**: Message data, templates, and handlers
- **Features**: Template selection, CSV upload, and bulk sending

### CampaignResults
- **Purpose**: Detailed campaign results analysis and display
- **Props**: Results data, campaign ID, and retry handlers
- **Features**: Advanced metrics, search, filtering, and export

### CampaignResultsModal
- **Purpose**: Modal for displaying campaign results
- **Props**: Results data and modal controls
- **Features**: Comprehensive results display with statistics

### TemplateManagement
- **Purpose**: WhatsApp template management interface
- **Props**: Template data, editing states, and handlers
- **Features**: Create, edit, sync, and manage WhatsApp templates

## Custom Hook

### useBroadcast
- **Location**: `../../hooks/useBroadcast.js`
- **Purpose**: Centralized state management and API logic for broadcast functionality
- **Features**: 
  - State management for all broadcast data
  - API calls for templates and broadcasts
  - Utility functions for calculations and formatting
  - Filter and sort logic
  - Event handlers for common operations

## Usage

### Importing Components
```javascript
import {
  BroadcastHeader,
  DateRangeFilter,
  OverviewStats,
  // ... other components
} from '../components/broadcastComponents';
```

### Using the Custom Hook
```javascript
import { useBroadcast } from '../hooks/useBroadcast';

const MyComponent = () => {
  const {
    broadcasts,
    loadBroadcasts,
    createBroadcast,
    // ... other hook returns
  } = useBroadcast();
  
  // Component logic
};
```

## Benefits of Refactoring

1. **Maintainability**: Smaller, focused components are easier to debug and modify
2. **Reusability**: Components can be reused in other parts of the application
3. **Testability**: Individual components can be unit tested in isolation
4. **Performance**: Smaller components enable better optimization and lazy loading
5. **Developer Experience**: Clear separation of concerns makes the codebase easier to understand
6. **Scalability**: New features can be added as separate components without affecting existing code

## Props Interface

Each component follows a consistent props pattern:
- **Data props**: Arrays, objects, and primitive values
- **Event handlers**: Functions prefixed with `on` (e.g., `onSubmit`, `onChange`)
- **UI state props**: Booleans for visibility, strings for active states
- **Utility functions**: Helper functions passed down for calculations

All components are functional components using React hooks and modern JavaScript features.

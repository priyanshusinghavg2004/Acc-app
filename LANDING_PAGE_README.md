# Acctoo Landing Page

## Overview
A modern, responsive landing page for the Acctoo accounting software that showcases features, pricing plans, and testimonials.

## Features

### 1. Hero Section
- Compelling headline with call-to-action buttons
- "Start Free Trial" and "Watch Demo" buttons
- Gradient background for visual appeal

### 2. Features Section
- 6 key features with icons and descriptions:
  - Invoice Management
  - Purchase Management
  - Payment Tracking
  - Advanced Reports
  - Party Management
  - Manufacturing

### 3. Screenshots Section
- Placeholder sections for dashboard, invoicing, and reports screenshots
- Each section includes an icon and description
- Ready for actual screenshots to be added

### 4. Pricing Section
- Three pricing tiers:
  - **Acctoo Beginner** (Current) - ₹999/month
  - **Acctoo Pro** (Coming Soon) - ₹1,999/month
  - **Acctoo Enterprise** (Coming Soon) - Custom pricing
- Feature comparison table
- Clear feature lists for each plan

### 5. Testimonials Section
- Customer reviews with star ratings
- Company names and testimonials
- Hover effects for better UX

### 6. Call-to-Action Section
- Final conversion section with trial and demo buttons
- Blue gradient background for emphasis

### 7. Footer
- Company information and links
- Organized into sections: Product, Support, Company

## Customization

### Adding Screenshots
1. Replace the placeholder divs in the screenshots section with actual images
2. Update the image paths in the LandingPage.js file
3. Ensure images are optimized for web (recommended size: 800x600px)

### Updating Pricing
1. Modify the `pricingPlans` array in LandingPage.js
2. Update features, prices, and descriptions
3. Adjust the comparison table accordingly

### Adding Features
1. Add new features to the `features` array
2. Include appropriate icons from react-icons/fa
3. Update the grid layout if needed

### Styling
- CSS classes are defined in `LandingPage.css`
- Uses Tailwind CSS for responsive design
- Custom animations and hover effects included

## Navigation
- Fixed navigation bar with smooth scrolling
- Login button that redirects to `/login`
- Mobile-responsive design

## Responsive Design
- Mobile-first approach
- Responsive grid layouts
- Optimized for all screen sizes

## Performance
- Optimized images and icons
- Smooth scrolling and animations
- Fast loading times

## Future Enhancements
- Add video demo functionality
- Integrate with analytics
- Add more interactive elements
- Include blog section
- Add contact form

## File Structure
```
src/components/
├── LandingPage.js          # Main landing page component
└── LandingPage.css         # Custom styles

public/
└── screenshots/            # Screenshot images (to be added)
```

## Usage
The landing page is automatically shown when users are not logged in. Users can:
1. View features and pricing
2. Start a free trial (redirects to registration)
3. Access the login page via the login button
4. Navigate through different sections

## Dependencies
- React Router DOM for navigation
- React Icons for icons
- Tailwind CSS for styling
- Custom CSS for animations 
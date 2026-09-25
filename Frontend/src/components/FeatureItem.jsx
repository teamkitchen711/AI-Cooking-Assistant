import React from 'react';

/*
 * Reusable feature row component with alternating layout support.
 * @param {string} title - Section title for the feature
 * @param {string} description - Descriptive text for the feature
 * @param {React.ReactNode} children - Visual card element or image to display
 * @param {boolean} reverse - If true, displays text on left and visual card on right on md+ screens
 */
export default function FeatureItem({ title, description, children, reverse = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-12 lg:gap-16">
      {/* Visual / Card side */}
      <div className={`flex justify-center ${reverse ? 'order-1 md:order-2' : ''}`}>
        {children}
      </div>

      {/* Text side */}
      <div className={`space-y-4 text-center md:text-left ${reverse ? 'order-2 md:order-1' : ''}`}>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-md mx-auto md:mx-0">
          {description}
        </p>
      </div>
    </div>
  );
}

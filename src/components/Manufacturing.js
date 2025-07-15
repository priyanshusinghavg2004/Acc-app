import React from 'react';

const Manufacturing = () => (
    <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Manufacturing Management</h2>
        <p className="text-gray-600">
            This module will manage the production process, including:
        </p>
        <ul className="list-disc list-inside text-gray-700 ml-4">
            <li>Tracking incoming raw materials (e.g., rolls, inks, other consumables).</li>
            <li>Recording the usage of these materials in the creation of final goods.</li>
            <li>Integrating with waste management, allowing for item-wise and general waste tracking.</li>
            <li>Future analysis to compare sales and purchase prices of raw materials with the final product cost for profitability insights.</li>
        </ul>
        <p className="text-gray-600 mt-4">(Coming Soon)</p>
    </div>
);

export default Manufacturing; 
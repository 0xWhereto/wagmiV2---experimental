import React from "react";

const NetworkSelector = ({ networks, selectedNetwork, onSelect }) => {
  return (
    <select
      value={selectedNetwork?.id || ""}
      onChange={(e) => {
        const networkId = parseInt(e.target.value);
        const selected = networks.find((n) => n.id === networkId);
        onSelect(selected);
      }}
    >
      <option value="">Select Network</option>
      {networks.map((network) => (
        <option key={network.id} value={network.id}>
          {network.name}
        </option>
      ))}
    </select>
  );
};

export default NetworkSelector;

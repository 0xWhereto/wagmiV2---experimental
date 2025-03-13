import React from "react";

const NetworkBanner = ({ availableNetworks, onSwitchNetwork }) => {
  return (
    <div className="network-banner">
      <h3>Please connect to a supported network</h3>
      <div className="network-buttons">
        {availableNetworks.map((network) => (
          <button key={network.id} className="network-button" onClick={() => onSwitchNetwork(network)}>
            Connect to {network.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NetworkBanner;

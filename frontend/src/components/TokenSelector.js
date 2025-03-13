import React from "react";

const TokenSelector = ({ tokens, selectedToken, onSelect }) => {
  return (
    <select
      value={selectedToken?.address || ""}
      onChange={(e) => {
        const tokenAddress = e.target.value;
        const selected = tokens.find((t) => t.address === tokenAddress);
        onSelect(selected);
      }}
    >
      <option value="">Select Token</option>
      {tokens.map((token) => (
        <option key={token.address} value={token.address}>
          {token.symbol} ({token.name})
        </option>
      ))}
    </select>
  );
};

export default TokenSelector;

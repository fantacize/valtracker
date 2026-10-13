import { useState } from 'react';
import { agentIconUrl } from '../lib/gameArt';

function AgentAvatar({ characterId, agentName, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const src = agentIconUrl(characterId);
  const style = { width: size, height: size };

  if (!src || failed) {
    return <span className="agent-avatar fallback" style={style} title={agentName || 'Unknown agent'}>{(agentName || '?').slice(0, 1)}</span>;
  }

  return (
    <img
      className="agent-avatar"
      style={style}
      src={src}
      alt={agentName || 'Agent'}
      title={agentName || undefined}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default AgentAvatar;

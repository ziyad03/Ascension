const fs = require('fs');

let content = fs.readFileSync('src/pages/Team.jsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('{/* ── Question ── */}'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('          {/* ── Stats ── */}'));

if (startIndex !== -1 && endIndex !== -1) {
  const newBlock = `          {/* ── Question ── */}
          <div className="area-question">
            {question ? (
              <>
                <div className="neon-q-card" key={question.id}>
                  <div className="neon-quiz-badge">QUIZ</div>
                  <div className="q-tags">
                    <span className="qtag qtag-cat">{question.category}</span>
                    <span className="qtag qtag-pts">{question.points} pts</span>
                    <span className={\`qtag \${diffCls}\`}>{diffLbl}</span>
                  </div>
                  <p className="neon-q-text">
                    {question.text || question.question || 'Chargement...'}
                  </p>
                  {question.imageUrl && (
                    <img src={question.imageUrl} alt="Illustration" className="q-img" />
                  )}
                </div>
                {Array.isArray(question.options) && question.options.length > 0 && (
                  <div className="neon-options-grid">
                    {question.options.map((opt, i) => (
                      <div key={i} className="neon-option-pill">
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="neon-q-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
                <div className="neon-quiz-badge">QUIZ</div>
                <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'1.1rem', textAlign:'center', fontWeight: 'bold' }}>
                  En attente d'une question du modérateur…
                </p>
              </div>
            )}
          </div>
`;

  lines.splice(startIndex, endIndex - startIndex, newBlock);
  fs.writeFileSync('src/pages/Team.jsx', lines.join('\n'));
  console.log('Fixed Team.jsx');
} else {
  console.log('Failed to find indices', startIndex, endIndex);
}

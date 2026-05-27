import styles from './page.module.scss';

function ComingSoonPage() {
  return (
    <main className={styles.page} data-test-id='coming-soon-page'>
      <div className={styles.content}>
        <svg
          aria-hidden='true'
          className={styles.mascot}
          fill='none'
          viewBox='0 0 160 160'
          xmlns='http://www.w3.org/2000/svg'
        >
          <rect fill='#fdecd9' height='144' rx='36' width='144' x='8' y='8' />
          <circle cx='55' cy='66' fill='#e8651a' r='13' />
          <circle cx='51' cy='62' fill='white' r='5' />
          <path
            d='M 87 65 Q 101 52 115 65'
            fill='none'
            stroke='#e8651a'
            strokeLinecap='round'
            strokeWidth='6'
          />
          <path
            d='M 50 100 Q 80 124 110 100'
            fill='none'
            stroke='#e8651a'
            strokeLinecap='round'
            strokeWidth='6'
          />
        </svg>
        <h1 className={styles.brand}>My App</h1>
        <p className={styles.tagline}>Coming soon.</p>
      </div>
    </main>
  );
}

ComingSoonPage.displayName = 'ComingSoonPage';

export default ComingSoonPage;

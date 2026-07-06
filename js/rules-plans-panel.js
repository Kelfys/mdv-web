import { renderSubscriptionPlanCards } from './plans.js'
import { t } from './strings.js'

/** Painel de regras e planos nas páginas Entrar e Criar conta (colapsável). */
export function renderRulesAndPlansContent() {
  const planCards = renderSubscriptionPlanCards({ infoOnly: true })

  return `
    <div class="auth-info-panel">
      <h2 class="auth-info-panel__title" id="regras">${t('rules.title')}</h2>

      <section class="rules-section">
        <h3>${t('rules.section1Title')}</h3>
        <p>${t('rules.section1Body')}</p>
      </section>

      <section class="rules-section">
        <h3>${t('rules.section2Title')}</h3>
        <ul>
          <li>${t('rules.section2Item1')}</li>
          <li>${t('rules.section2Item2')}</li>
          <li>${t('rules.section2Item3')}</li>
        </ul>
      </section>

      <section class="rules-section">
        <h3>${t('rules.section3Title')}</h3>
        <ul>
          <li>${t('rules.section3Item1')}</li>
          <li>${t('rules.section3Item2')}</li>
          <li>${t('rules.section3Item3')}</li>
          <li>${t('rules.section3Item4')}</li>
        </ul>
      </section>

      <section class="rules-section" id="planos">
        <h3>${t('rules.section4Title')}</h3>
        <p>${t('rules.section4Body')}</p>
        <div class="plan-grid">${planCards}</div>
        <div class="plan-payment-info">
          <p><strong>${t('rules.section4HowToTitle')}</strong></p>
          <ol>
            <li>${t('rules.section4Step1')}</li>
            <li>${t('rules.section4Step2')}</li>
            <li>${t('rules.section4Step3')}</li>
            <li>${t('rules.section4Step4')}</li>
          </ol>
        </div>
      </section>

      <section class="rules-section">
        <h3>${t('rules.section5Title')}</h3>
        <p>${t('rules.section5Body')}</p>
      </section>
    </div>`
}
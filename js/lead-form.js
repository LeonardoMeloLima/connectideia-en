(function () {
    var TOTAL_STEPS = 6;
    var currentStep = 0;
    var leadData = { phase: '', bottleneck: '', site: '', timing: '', email: '', whatsapp: '', aiSummary: '' };
    var isProcessing = false;
    var hasStarted = false;

    var track = document.getElementById('ciFlowTrack');
    var progressFill = document.getElementById('ciProgressFill');
    var wrapper = track ? track.parentElement : null;

    function goToStep(idx) {
        if (!track) return;
        var allSteps = track.querySelectorAll('.ci-flow-step');
        allSteps.forEach(function(s, i) {
            s.style.visibility = (i === idx) ? 'visible' : 'hidden';
        });
        track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        currentStep = idx;
        updateProgress(idx);
        var steps = track.querySelectorAll('.ci-flow-step');
        if (wrapper && steps[idx]) {
            var targetStep = steps[idx];
            var innerEl = targetStep.querySelector('[class*="ci-flow-step-inner"]');
            // Mede a altura do step ativo forçando reflow imediato
            var savedTransition = wrapper.style.transition;
            wrapper.style.transition = 'none';
            wrapper.style.height = 'auto';
            void wrapper.offsetHeight; // força reflow
            var natural = innerEl ? innerEl.offsetHeight : targetStep.offsetHeight;
            if (!natural || natural < 80) natural = 160; // fallback de segurança
            wrapper.style.height = natural + 'px';
            requestAnimationFrame(function() {
                wrapper.style.transition = savedTransition;
            });
        }
        var modalEl = document.getElementById('ciFlowModal');
        if (modalEl) {
            var modalCtn = modalEl.closest('.pop-up_cta_c') || modalEl.parentElement;
            if (idx === 7) {
                modalEl.classList.add('ci-flow-modal--end');
                if (modalCtn) modalCtn.classList.add('ci-flow-modal--end');
            } else {
                modalEl.classList.remove('ci-flow-modal--end');
                if (modalCtn) modalCtn.classList.remove('ci-flow-modal--end');
            }
        }
    }

    function initFlow() {
        if (!wrapper || !track) return;
        var steps = track.querySelectorAll('.ci-flow-step');
        steps.forEach(function(s, i) {
            s.style.visibility = i === 0 ? 'visible' : 'hidden';
        });
        // Mede a altura do primeiro step com reflow forçado
        setTimeout(function() {
            if (steps[0]) {
                var inner0 = steps[0].querySelector('[class*="ci-flow-step-inner"]');
                wrapper.style.transition = 'none';
                wrapper.style.height = 'auto';
                void wrapper.offsetHeight;
                var h = inner0 ? inner0.offsetHeight : steps[0].offsetHeight;
                if (!h || h < 80) h = 160;
                wrapper.style.height = h + 'px';
                requestAnimationFrame(function() { wrapper.style.transition = ''; });
            }
        }, 100);
    }

    function handleCtaClick(e) {
        setTimeout(initFlow, 100);
        document.body.classList.add('ci-modal-open');
        document.documentElement.classList.add('ci-modal-open');
        if (window.lenis) window.lenis.stop();
    }
    function handleCtaClose() {
        document.body.classList.remove('ci-modal-open');
        document.documentElement.classList.remove('ci-modal-open');
        if (window.lenis) window.lenis.start();
    }
    document.querySelectorAll('[pop-up-open="cta"]').forEach(function(el) {
        el.addEventListener('click', handleCtaClick);
    });
    document.querySelectorAll('[pop-up-close="cta"]').forEach(function(el) {
        el.addEventListener('click', handleCtaClose);
    });

    function updateProgress(stepIdx) {
        var userSteps = [0,1,2,4,5,6];
        var filled = userSteps.indexOf(stepIdx);
        if (filled < 0) filled = userSteps.length;
        var pct = Math.min(100, (filled / TOTAL_STEPS) * 100);
        if (progressFill) progressFill.style.width = pct + '%';
    }

    // ── Step 0: E-mail ────────────────────────
    function submitEmail() {
        if (isProcessing) return;
        var val = document.getElementById('ciInputEmail').value.trim();
        var err = document.getElementById('ciEmailError');
        var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(val)) {
            if (err) err.textContent = 'Please enter a valid email.';
            flashError('ciInputEmail');
            return;
        }
        if (err) err.textContent = '';
        leadData.email = val;
        goToStep(1);
    }
    document.getElementById('ciSubmitEmail').onclick = submitEmail;
    document.getElementById('ciInputEmail').onkeypress = function(e) { if (e.key === 'Enter') submitEmail(); };

    // ── Steps 1 e 2: Fase e Gargalo ──────────
    document.querySelectorAll('.ci-flow-step[data-step="1"] .ci-flow-opt').forEach(function(btn) {
        btn.onclick = function() {
            if (isProcessing) return;
            leadData.phase = this.dataset.value;
            goToStep(2);
        };
    });
    document.querySelectorAll('.ci-flow-step[data-step="2"] .ci-flow-opt').forEach(function(btn) {
        btn.onclick = function() {
            if (isProcessing) return;
            leadData.bottleneck = this.dataset.value;
            goToStep(3);
        };
    });

    // ── Step 3: Site → análise ────────────────
    function submitSite() {
        if (isProcessing) return;
        var val = document.getElementById('ciInputSite').value.trim();
        if (!val) { flashError('ciInputSite'); return; }
        leadData.site = val;
        isProcessing = true;
        goToStep(4);
        runAnalysis(val);
    }
    document.getElementById('ciSubmitSite').onclick = submitSite;
    document.getElementById('ciInputSite').onkeypress = function(e) { if (e.key === 'Enter') submitSite(); };

    function runAnalysis(url) {
        var loading = document.getElementById('ciAnalysisLoading');
        var results = document.getElementById('ciAnalysisResults');
        var neg = document.getElementById('ciAnalysisNegocio');
        var gap = document.getElementById('ciAnalysisGap');
        var acao = document.getElementById('ciAnalysisAcao');
        var next = document.getElementById('ciAnalysisNext');

        if (loading) loading.style.display = 'flex';
        if (results) results.style.display = 'none';

        function syncHeight() {
            setTimeout(function() {
                if (wrapper && track) {
                    var steps = track.querySelectorAll('.ci-flow-step');
                    if (steps[4]) wrapper.style.height = steps[4].offsetHeight + 'px';
                }
            }, 50);
        }

        fetch('https://kfgkozztzxrpppwzhidk.supabase.co/functions/v1/analyze?t=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': 'sb_publishable_A8Acv3HqTCy-FubIG5VBNQ_xoKfH1Qx',
                'Authorization': 'Bearer sb_publishable_A8Acv3HqTCy-FubIG5VBNQ_xoKfH1Qx'
            },
            body: JSON.stringify({ url: url, phase: leadData.phase, bottleneck: leadData.bottleneck })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (loading) loading.style.display = 'none';
            if (!data.skipped && data.analysis) {
                leadData.aiSummary = data.analysis.negocio + ' | ' + data.analysis.gap + ' | ' + data.analysis.acao;
                if (neg) neg.innerHTML = '🏢 <strong>' + data.analysis.negocio + '</strong>';
                if (gap) gap.textContent = '⚠️ ' + data.analysis.gap;
                if (acao) acao.innerHTML = '🚀 <strong>' + data.analysis.acao + '</strong>';
                if (next) next.textContent = 'Makes sense — continue →';
            } else {
                leadData.aiSummary = 'Profile-based analysis';
                if (data.skipped === 'SCRAPE_FAIL') {
                    if (neg) neg.innerHTML = '🏢 <strong>Profile Diagnosis</strong>';
                    if (gap) gap.textContent = "We couldn't read all the details of your site right now, but we identified your business profile as " + (leadData.phase || 'business') + '.';
                    if (acao) acao.innerHTML = '🚀 <strong>Suggestion:</strong> Focus on resolving your ' + (leadData.bottleneck || 'growth') + ' bottleneck with a tailored solution.';
                } else {
                    leadData.aiSummary = 'Strategic diagnosis prepared';
                    if (neg) neg.innerHTML = '🏢 <strong>Strategic Diagnosis</strong>';
                    if (gap) gap.textContent = 'I analyzed your current stage as ' + (leadData.phase || 'business') + ' and prepared recommendations for your ' + (leadData.bottleneck || 'growth') + ' bottleneck.';
                    if (acao) acao.innerHTML = '🚀 <strong>Action Plan:</strong> Click below to continue to your personalized execution plan.';
                }
                if (next) next.textContent = 'Continue →';
            }
            if (results) results.style.display = 'flex';
            setTimeout(function() { if (neg) neg.classList.add('visible'); }, 150);
            setTimeout(function() { if (gap) gap.classList.add('visible'); }, 400);
            setTimeout(function() { if (acao) acao.classList.add('visible'); }, 650);
            setTimeout(function() { if (next) next.classList.add('visible'); }, 900);
            syncHeight();
        })
        .catch(function(err) {
            if (loading) loading.style.display = 'none';
            leadData.aiSummary = 'Simplified analysis';
            if (neg) neg.innerHTML = '🏢 <strong>Strategic Diagnosis</strong>';
            if (gap) gap.textContent = 'We prepared recommendations focused on ' + (leadData.bottleneck || 'optimization') + ' based on the data you provided.';
            if (acao) acao.innerHTML = '🚀 <strong>Action:</strong> Click below to save and continue with your plan.';
            if (results) results.style.display = 'flex';
            if (next) { next.textContent = 'Continue →'; next.classList.add('visible'); }
            [neg, gap, acao].forEach(function(el) { if(el) el.classList.add('visible'); });
            syncHeight();
        });
    }

    var analysisNext = document.getElementById('ciAnalysisNext');
    if (analysisNext) {
        analysisNext.onclick = function() {
            isProcessing = false;
            goToStep(5);
        };
    }

    // ── Step 5: Timing ────────────────────────
    document.querySelectorAll('.ci-flow-step[data-step="5"] .ci-flow-opt').forEach(function(btn) {
        btn.onclick = function() {
            if (isProcessing) return;
            leadData.timing = this.dataset.value;
            goToStep(6);
        };
    });

    // ── Step 6: WhatsApp → salva → fim ────────
    function submitWhatsapp() {
        if (isProcessing) return;
        var val = document.getElementById('ciInputWhatsapp').value.trim();
        var err = document.getElementById('ciWhatsappError');
        if (val.replace(/\D/g,'').length < 8) {
            if (err) err.textContent = 'Please include country code and number.';
            flashError('ciInputWhatsapp');
            return;
        }
        if (err) err.textContent = '';
        leadData.whatsapp = val;
        isProcessing = true;
        goToStep(7);
        saveLead();
    }
    document.getElementById('ciSubmitWhatsapp').onclick = submitWhatsapp;
    document.getElementById('ciInputWhatsapp').onkeypress = function(e) { if (e.key === 'Enter') submitWhatsapp(); };

    function saveLead() {
        // 1. Salva no banco de dados (opcional, mantendo sua integração original)
        fetch('/api/save-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        }).catch(function(e) {});

        // 2. Prepara a mensagem para o seu WhatsApp
        var parts = (leadData.aiSummary || '').split(' | ');
        var msg = "*🚀 New ConnectIdeia Diagnosis*\n\n" +
                  "*👤 Email:* " + leadData.email + "\n" +
                  "*📊 Stage:* " + leadData.phase + "\n" +
                  "*⚠️ Bottleneck:* " + leadData.bottleneck + "\n" +
                  "*🔗 Site:* " + leadData.site + "\n" +
                  "*⏳ Priority:* " + leadData.timing + "\n" +
                  "*📱 Lead WhatsApp:* " + leadData.whatsapp + "\n\n" +
                  "*🤖 AI Analysis:* \n_" + (parts[0] || parts[1] || 'Diagnosis prepared') + "_\n\n" +
                  "I'd like to schedule a meeting to go over these points.";

        var whatsappUrl = "https://wa.me/5519991697179?text=" + encodeURIComponent(msg);

        // 3. Redireciona logo após o salvamento
        setTimeout(function() {
            window.open(whatsappUrl, '_blank');
            goToStep(7); // Vai para o passo final de "Sucesso" no site
            isProcessing = false;
        }, 800);
    }

    function flashError(inputId) {
        var input = document.getElementById(inputId);
        if (!input) return;
        var group = input.closest('.ci-flow-input-group');
        if (group) {
            group.classList.add('error');
            setTimeout(function() { group.classList.remove('error'); }, 1500);
        }
    }

    function resetFlow() {
        leadData = { phase: '', bottleneck: '', site: '', timing: '', email: '', whatsapp: '', aiSummary: '' };
        currentStep = 0;
        isProcessing = false;
        hasStarted = false;
        if (wrapper) {
            wrapper.style.transition = 'none';
            wrapper.style.height = '';
        }
        goToStep(0);
        requestAnimationFrame(function() { requestAnimationFrame(function() {
            if (wrapper) wrapper.style.transition = '';
        }); });
        ['ciInputSite','ciInputEmail','ciInputWhatsapp'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        var loading = document.getElementById('ciAnalysisLoading');
        var results = document.getElementById('ciAnalysisResults');
        if (loading) loading.style.display = 'flex';
        if (results) results.style.display = 'none';
        ['ciAnalysisNegocio','ciAnalysisGap','ciAnalysisAcao','ciAnalysisNext'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.classList.remove('visible'); if (id !== 'ciAnalysisNext') el.textContent = ''; }
        });
    }

    function handleCtaForm() {
        var nameEl = document.getElementById('name');
        var emailEl = document.getElementById('email');
        
        if (!nameEl.value || !emailEl.value) {
            alert('Please fill in your name and email.');
            return;
        }

        var name = nameEl.value;
        var email = emailEl.value;
        var msg = "*🚀 New Lead - ConnectIdeia*\n\n" +
                  "*👤 Name:* " + name + "\n" +
                  "*📧 Email:* " + email + "\n\n" +
                  "I'd like to start my strategic analysis.";
        var url = "https://wa.me/5519991697179?text=" + encodeURIComponent(msg);
        
        // Redirecionamento direto
        window.location.href = url;
    }

    var ctaBtn = document.getElementById('ctaSubmitBtn');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', handleCtaForm);
    }

    var popupEl = document.querySelector('[pop-up="cta"]');
    if (popupEl) {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.attributeName === 'class') {
                    var isOpen = popupEl.classList.contains('is-open') ||
                                 popupEl.classList.contains('is-active') ||
                                 popupEl.classList.contains('active');
                    if (!isOpen && currentStep > 0) {
                        setTimeout(resetFlow, 400);
                    }
                }
            });
        });
        observer.observe(popupEl, { attributes: true });
    }

    document.querySelectorAll('[pop-up-close="cta"]').forEach(function(el) {
        el.addEventListener('click', function() {
            setTimeout(resetFlow, 500);
        });
    });

})();

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

export const ecourtsRouter = Router()

ecourtsRouter.use(requireAuth)

// GET /api/ecourts/search?cnr=... or ?caseNo=&court=&state=&year=
// eCourts public API is rate-limited and requires browser-like headers.
// We scaffold the integration with a best-effort fetch and return mock on failure.
ecourtsRouter.get('/search', async (req, res, next) => {
  try {
    const { cnr, caseNo, court, state, year } = req.query as Record<string, string>

    if (!cnr && !caseNo) {
      res.status(400).json({ error: 'Provide cnr or caseNo parameter' })
      return
    }

    // Validate CNR format: 16 alphanumeric characters (e.g., MHNS010012342024)
    if (cnr && !/^[A-Z0-9]{10,20}$/i.test(cnr)) {
      res.status(400).json({ error: 'Invalid CNR format. Expected 16 alphanumeric characters.' })
      return
    }

    // Validate caseNo: numeric only
    if (caseNo && !/^\d{1,15}$/.test(caseNo)) {
      res.status(400).json({ error: 'Invalid case number format.' })
      return
    }

    // Attempt real eCourts API (CNR lookup)
    if (cnr) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const response = await fetch(
          `https://services.ecourts.gov.in/ecourtindiawebservices/getCaseDetail?cnr_no=${encodeURIComponent(cnr)}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'application/json',
            },
            signal: controller.signal,
          },
        )
        clearTimeout(timeout)
        if (response.ok) {
          const data = await response.json()
          res.json({ source: 'ecourts', data })
          return
        }
      } catch {
        // Fall through to mock
      }
    }

    // Return scaffolded/mock response when API is unavailable
    const mockResult = {
      source: 'mock',
      note: 'eCourts API is currently unavailable. Showing demo data for reference.',
      case: {
        cnr_number: cnr ?? `${state ?? 'MH'}${court ?? '01'}${year ?? '2024'}${caseNo ?? '001234'}`,
        case_type: 'Civil Suit',
        filing_number: caseNo ?? 'CS/1234/2024',
        filing_date: '15 Jan 2024',
        registration_number: `CS-${year ?? '2024'}-001234`,
        registration_date: '18 Jan 2024',
        first_hearing_date: '20 Feb 2024',
        next_hearing_date: '15 Apr 2025',
        purpose_of_next_hearing: 'Arguments',
        stage: 'Arguments',
        court_number_and_judge: `Court No. ${court ?? '12'}, Hon. Addl. District Judge`,
        petitioner: 'XYZ Pvt Ltd vs',
        respondent: 'ABC Corporation',
        acts: ['Code of Civil Procedure, 1908 - Section 9', 'Specific Relief Act, 1963 - Section 10'],
        history: [
          { date: '20 Feb 2024', purpose: 'Service of summons', judge: 'ADJ' },
          { date: '15 Mar 2024', purpose: 'Written statement', judge: 'ADJ' },
          { date: '10 Apr 2024', purpose: 'Issues framing', judge: 'ADJ' },
          { date: '12 Jun 2024', purpose: 'Evidence', judge: 'ADJ' },
          { date: '05 Sep 2024', purpose: 'Arguments', judge: 'ADJ' },
        ],
        status: 'Pending',
      },
    }

    res.json(mockResult)
  } catch (err) {
    next(err)
  }
})

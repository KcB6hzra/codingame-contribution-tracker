import CodinGameAPI from './api/client.js';
import FileHandler from './utils/fileHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const cookie = process.env.CG_COOKIE;
  const userIdStr = process.env.CG_USER_ID;
  
  if (!cookie) {
    console.error('Error: CG_COOKIE environment variable is not set.');
    process.exit(1);
  }
  if (!userIdStr) {
    console.error('Error: CG_USER_ID environment variable is not set.');
    process.exit(1);
  }

  const userId = parseInt(userIdStr, 10);
  if (isNaN(userId)) {
    console.error('Error: CG_USER_ID must be a number.');
    process.exit(1);
  }

  // Use ./data directory for data storage as per plan
  // Allow override via environment variable for flexibility (e.g. in GitHub Actions)
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const api = new CodinGameAPI(cookie, userId);
  const fileHandler = new FileHandler(dataDir);

  console.log('Fetching contributions...');
  const [pending, accepted] = await Promise.all([
    api.getAllPendingContributions(),
    api.getAcceptedContributions()
  ]);

  let allContributions = [...pending, ...accepted];
  console.log(`Found ${allContributions.length} contributions (pending + accepted).`);

  // Handle extra/private contributions specified manually
  const extraHandles = process.env.EXTRA_HANDLES ? process.env.EXTRA_HANDLES.split(',').map(h => h.trim()).filter(h => h) : [];
  if (extraHandles.length > 0) {
    console.log(`Fetching ${extraHandles.length} extra handles...`);
    for (const handle of extraHandles) {
      // Avoid duplicates if they were already in pending/accepted
      if (allContributions.find(c => c.publicHandle === handle)) continue;
      
      try {
        const detail = await api.findContribution(handle);
        // Map API detail response to the format used in allContributions list
        // findContribution returns the same object structure that contains version info
        allContributions.push({
          publicHandle: handle,
          activeVersion: detail.activeVersion,
          commentCount: detail.commentCount,
          commentableId: detail.commentableId,
        });
      } catch (err) {
        console.error(`Failed to fetch extra handle ${handle}:`, err.message);
      }
    }
  }

  const testHandles = process.env.TEST_HANDLES ? process.env.TEST_HANDLES.split(',').map(h => h.trim()) : null;
  if (testHandles && testHandles.length > 0) {
    console.log(`Testing with specific handles: ${testHandles.join(', ')}`);
    allContributions = allContributions.filter(c => testHandles.includes(c.publicHandle));
    console.log(`Matched ${allContributions.length} contributions for testing.`);
  }

  for (const contribution of allContributions) {
    const { publicHandle, activeVersion, commentCount, commentableId } = contribution;
    
    let shouldUpdateContribution = false;
    let shouldUpdateComments = false;

    // 1. Check if contribution needs update
    if (!fileHandler.isKnownContribution(publicHandle)) {
      console.log(`New contribution found: ${publicHandle}`);
      shouldUpdateContribution = true;
    } else {
      const lastSaved = fileHandler.getLastSavedContribution(publicHandle);
      if (lastSaved && lastSaved.activeVersion !== activeVersion) {
        console.log(`Contribution updated: ${publicHandle} (version: ${lastSaved.activeVersion} -> ${activeVersion})`);
        shouldUpdateContribution = true;
      }
    }

    if (shouldUpdateContribution) {
      try {
        const detail = await api.findContribution(publicHandle);
        fileHandler.saveContribution(publicHandle, detail);
      } catch (err) {
        console.error(`Failed to fetch detail for ${publicHandle}:`, err.message);
      }
    }

    // 2. Check if comments need update
    if (!shouldUpdateComments) {
      const lastComments = fileHandler.getLastSavedComments(publicHandle);
      // In CodinGame API, the contribution summary itself has commentCount
      if (!lastComments || (commentCount !== undefined && lastComments.length !== commentCount)) {
        console.log(`Comments updated for ${publicHandle}: ${lastComments ? lastComments.length : 0} -> ${commentCount}`);
        shouldUpdateComments = true;
      }
    }

    if (shouldUpdateComments) {
      try {
        let comments = await api.getFirstLevelComments(commentableId);
        
        // Check for second level comments for each first level comment
        // In CodinGame API, if a comment has responses, responseCount > 0.
        // The first response is often included in FirstLevel, but subsequent ones (responseCount >= 2)
        // require calling getSecondLevelComments.
        const originalComments = [...comments];
        for (const comment of originalComments) {
          if (comment.responseCount >= 2) {
            try {
              const secondLevel = await api.getSecondLevelComments(comment.commentId);
              // Merge second level comments (avoiding duplicates)
              for (const sc of secondLevel) {
                if (!comments.find(c => c.commentId === sc.commentId)) {
                  comments.push(sc);
                }
              }
            } catch (err) {
              console.error(`Failed to fetch second level comments for comment ${comment.commentId}:`, err.message);
            }
          }
        }
        
        fileHandler.saveComments(publicHandle, comments);
      } catch (err) {
        console.error(`Failed to fetch comments for ${publicHandle}:`, err.message);
      }
    }
  }

  console.log('Generating indices...');
  fileHandler.generateIndices();

  console.log('Update completed.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

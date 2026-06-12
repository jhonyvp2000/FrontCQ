import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server"; // Use correct path

export default withAuth(
    function middleware(req) {
        const isAuth = !!req.nextauth.token;
        const isAuthPage = req.nextUrl.pathname === '/login';

        // Redirect unauthenticated off root to /login
        if (req.nextUrl.pathname === '/' && !isAuth) {
            return NextResponse.redirect(new URL('/login', req.url));
        }

        // Redirect authenticated users away from /login unless there is a session error
        if (isAuthPage && isAuth) {
            const hasSessionError = req.nextUrl.searchParams.has('error') && 
                (req.nextUrl.searchParams.get('error') === 'SessionExpired' || req.nextUrl.searchParams.get('error') === 'forced_logout');
            
            if (!hasSessionError) {
                return NextResponse.redirect(new URL('/', req.url));
            }
        }
    },
    {
        callbacks: {
            authorized: () => true, // Run middleware on all matched routes to handle redirects manually
        },
    }
);

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

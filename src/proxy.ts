import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function proxy(req) {
        const isAuth = !!req.nextauth.token;
        const isAuthPage = req.nextUrl.pathname === '/login';
        const isChangePasswordPage = req.nextUrl.pathname === '/change-password';
        const mustChangePassword = !!req.nextauth.token?.mustChangePassword;
        // Redirect unauthenticated off root or change-password to /login
        if (!isAuth && (req.nextUrl.pathname === '/' || isChangePasswordPage)) {
            return NextResponse.redirect(new URL('/login', req.url));
        }

        // Redirect authenticated users who must change password to /change-password
        if (isAuth && mustChangePassword && !isChangePasswordPage && !isAuthPage) {
            return NextResponse.redirect(new URL('/change-password', req.url));
        }

        // Prevent users who don't need to change password from accessing /change-password
        if (isAuth && !mustChangePassword && isChangePasswordPage) {
            return NextResponse.redirect(new URL('/', req.url));
        }

        // Redirect authenticated users away from /login unless there is a session error
        if (isAuthPage && isAuth) {
            const hasSessionError = req.nextUrl.searchParams.has('error') && 
                (req.nextUrl.searchParams.get('error') === 'SessionExpired' || req.nextUrl.searchParams.get('error') === 'forced_logout');
            
            if (!hasSessionError) {
                if (mustChangePassword) {
                    return NextResponse.redirect(new URL('/change-password', req.url));
                }
                return NextResponse.redirect(new URL('/', req.url));
            }
        }
    },
    {
        callbacks: {
            authorized: () => true, // Run proxy on all matched routes to handle redirects manually
        },
    }
);

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

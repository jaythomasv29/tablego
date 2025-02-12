export default function Footer() {
    return (
        <footer className="bg-white border-t mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto">
                    {/* Contact Information */}
                    <div className="text-xs text-gray-500 text-center space-y-1">
                        <p>
                            <a
                                href="https://maps.google.com/?q=543+Emerson+St+Palo+Alto+CA+94301"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-indigo-600 transition-colors"
                            >
                                543 Emerson St, Palo Alto, CA 94301
                            </a>
                        </p>
                        <p>
                            <a
                                href="https://thaiphoonpa.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-indigo-600 transition-colors"
                            >
                                thaiphoonpa.com
                            </a>
                        </p>
                        <p>
                            <a
                                href="tel:+16503237700"
                                className="hover:text-indigo-600 transition-colors"
                            >
                                (650) 323-7700
                            </a>
                        </p>

                    </div>

                    {/* Management Links */}
                    <div className="text-xs text-gray-500 text-center space-y-1">

                        <p>
                            <a
                                href="mailto:thaiphoonpaloalto@gmail.com"
                                className="hover:text-indigo-600 transition-colors"
                            >
                                Contact Us
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
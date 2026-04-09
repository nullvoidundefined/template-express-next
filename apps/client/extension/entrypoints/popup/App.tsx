import { QueryProvider } from '../../providers/QueryProvider';

function App() {
    return (
        <QueryProvider>
            <div>Extension popup</div>
        </QueryProvider>
    );
}

App.displayName = 'App';

export { App };
